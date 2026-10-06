import {
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import {
  notFound,
  redirect,
} from "next/navigation";
import GoWishlistLogo from "../../../components/GoWishlistLogo";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";
import { getAffiliateUrl } from "../../../lib/affiliate";
import {
  createWishlistAccessToken,
  getWishlistAccessCookieName,
} from "../../../lib/wishlist-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyAccessCode(
  code: string,
  storedHash: string
) {
  try {
    const [method, saltHex, hashHex] =
      storedHash.split("$");

    if (
      method !== "scrypt" ||
      !saltHex ||
      !hashHex
    ) {
      return false;
    }

    const salt = Buffer.from(
      saltHex,
      "hex"
    );

    const storedBuffer = Buffer.from(
      hashHex,
      "hex"
    );

    const enteredBuffer = scryptSync(
      code,
      salt,
      storedBuffer.length
    );

    if (
      enteredBuffer.length !==
      storedBuffer.length
    ) {
      return false;
    }

    return timingSafeEqual(
      enteredBuffer,
      storedBuffer
    );
  } catch {
    return false;
  }
}

function createVisitorKey(
  ipAddress: string
) {
  const secret =
    process.env.SUPABASE_SECRET_KEY;

  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY is missing."
    );
  }

  return createHmac(
    "sha256",
    secret
  )
    .update(
      `wishlist:${ipAddress}`
    )
    .digest("hex");
}

function formatPrice(
  price: number | string | null
) {
  if (
    price === null ||
    price === undefined ||
    price === ""
  ) {
    return null;
  }

  const value = Number(price);

  if (!Number.isFinite(value)) {
    return null;
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    }
  ).format(value);
}

export default async function PublicWishlistPage({
  params,
  searchParams,
}: {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const admin = createAdminClient();

  const {
    data: wishlist,
    error: wishlistError,
  } = await admin
    .from("wishlists")
    .select(
      "id, owner_id, title, slug, is_live, access_code_hash"
    )
    .eq(
      "slug",
      slug.toLowerCase()
    )
    .eq("is_live", true)
    .maybeSingle();

  if (
    wishlistError ||
    !wishlist
  ) {
    notFound();
  }

  const activeWishlist = wishlist;

  const supabase =
    await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner =
    Boolean(user) &&
    user?.id ===
      wishlist.owner_id;

  const cookieStore =
    await cookies();

  const accessCookieName =
    getWishlistAccessCookieName(
      wishlist.id
    );

  const expectedCookieValue =
    wishlist.access_code_hash
      ? createWishlistAccessToken(
          wishlist.id,
          wishlist.access_code_hash
        )
      : null;

  const savedCookie =
    cookieStore.get(
      accessCookieName
    )?.value;

  const isUnlocked =
    !wishlist.access_code_hash ||
    isOwner ||
    (Boolean(savedCookie) &&
      savedCookie ===
        expectedCookieValue);

  async function unlockWishlist(
    formData: FormData
  ) {
    "use server";

    const enteredCode = String(
      formData.get(
        "accessCode"
      ) || ""
    )
      .replace(/\D/g, "")
      .slice(0, 8);

    if (
      !/^[0-9]{4,8}$/.test(
        enteredCode
      )
    ) {
      redirect(
        `/wishlist/${activeWishlist.slug}?error=code`
      );
    }

    const requestHeaders =
      await headers();

    const forwardedFor =
      requestHeaders
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim() || "";

    const ipAddress =
      forwardedFor ||
      requestHeaders.get(
        "x-real-ip"
      ) ||
      requestHeaders.get(
        "cf-connecting-ip"
      ) ||
      "unknown";

    let visitorKey = "";

    try {
      visitorKey =
        createVisitorKey(
          ipAddress
        );
    } catch (error) {
      console.error(
        "Wishlist visitor key error:",
        error
      );

      redirect(
        `/wishlist/${activeWishlist.slug}?error=rate-limit`
      );
    }

    const admin =
      createAdminClient();

    const {
      data: currentWishlist,
    } = await admin
      .from("wishlists")
      .select(
        "id, slug, is_live, access_code_hash"
      )
      .eq(
        "id",
        activeWishlist.id
      )
      .eq("is_live", true)
      .maybeSingle();

    if (!currentWishlist) {
      notFound();
    }

    if (
      !currentWishlist.access_code_hash
    ) {
      redirect(
        `/wishlist/${currentWishlist.slug}`
      );
    }

    const codeIsCorrect =
      verifyAccessCode(
        enteredCode,
        currentWishlist.access_code_hash
      );

    const {
      data: attemptResult,
      error: attemptError,
    } = await admin.rpc(
      "handle_wishlist_unlock_attempt",
      {
        p_wishlist_id:
          currentWishlist.id,
        p_visitor_key:
          visitorKey,
        p_code_correct:
          codeIsCorrect,
      }
    );

    if (attemptError) {
      console.error(
        "Wishlist rate limit error:",
        attemptError
      );

      redirect(
        `/wishlist/${currentWishlist.slug}?error=rate-limit`
      );
    }

    const result =
      attemptResult as {
        allowed?: boolean;
        blocked?: boolean;
        invalid?: boolean;
        failed_attempts?: number;
        block_minutes?: number;
        blocked_until?: string | null;
      } | null;

    if (
      !result ||
      result.invalid
    ) {
      redirect(
        `/wishlist/${currentWishlist.slug}?error=rate-limit`
      );
    }

    if (result.blocked) {
      const blockMinutes =
        result.block_minutes === 60
          ? 60
          : result.block_minutes === 15
            ? 15
            : 5;

      redirect(
        `/wishlist/${currentWishlist.slug}?error=blocked-${blockMinutes}`
      );
    }

    if (!codeIsCorrect) {
      redirect(
        `/wishlist/${currentWishlist.slug}?error=code`
      );
    }

    if (!result.allowed) {
      redirect(
        `/wishlist/${currentWishlist.slug}?error=rate-limit`
      );
    }

    const cookieStore =
      await cookies();

    cookieStore.set(
      getWishlistAccessCookieName(
        currentWishlist.id
      ),
      createWishlistAccessToken(
        currentWishlist.id,
        currentWishlist.access_code_hash
      ),
      {
        httpOnly: true,
        sameSite: "lax",
        secure:
          process.env.NODE_ENV ===
          "production",
        path: "/",
        maxAge:
          60 * 60 * 24 * 30,
      }
    );

    redirect(
      `/wishlist/${currentWishlist.slug}`
    );
  }

  if (!isUnlocked) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background:
            "#f8fafc",
          color: "#111827",
        }}
      >
        <header
          style={{
            background:
              "#ffffff",
            borderBottom:
              "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              maxWidth:
                "900px",
              margin:
                "0 auto",
              padding:
                "20px 30px",
            }}
          >
            <GoWishlistLogo
              href="/home"
              size={29}
            />
          </div>
        </header>

        <section
          style={{
            maxWidth:
              "460px",
            margin:
              "0 auto",
            padding:
              "80px 30px",
          }}
        >
          <div
            style={{
              textAlign:
                "center",
              marginBottom:
                "28px",
            }}
          >
            <div
              style={{
                color:
                  "#2563eb",
                fontSize:
                  "13px",
                fontWeight:
                  "800",
                marginBottom:
                  "8px",
              }}
            >
              PRIVATE WISHLIST
            </div>

            <h1
              style={{
                margin: 0,
                fontSize:
                  "38px",
                lineHeight:
                  "1.1",
                letterSpacing:
                  "-1.5px",
                fontWeight:
                  "800",
              }}
            >
              {wishlist.title}
            </h1>

            <p
              style={{
                color:
                  "#6b7280",
                fontSize:
                  "15px",
                lineHeight:
                  "1.6",
                margin:
                  "12px 0 0",
              }}
            >
              Enter the guest access
              code to view this
              wishlist.
            </p>
          </div>

          <form
            action={
              unlockWishlist
            }
            style={{
              background:
                "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius:
                "20px",
              padding:
                "30px",
              boxShadow:
                "0 15px 40px rgba(0,0,0,0.06)",
            }}
          >
            {query.error && (
              <div
                style={{
                  background:
                    "#fef2f2",
                  border:
                    "1px solid #fecaca",
                  color:
                    "#b91c1c",
                  borderRadius:
                    "11px",
                  padding:
                    "13px 14px",
                  fontSize:
                    "14px",
                  fontWeight:
                    "700",
                  marginBottom:
                    "18px",
                }}
              >
                {query.error ===
                  "blocked-5"
                  ? "Too many incorrect attempts. Please wait 5 minutes and try again."
                  : query.error ===
                      "blocked-15"
                    ? "Too many incorrect attempts. Please wait 15 minutes and try again."
                    : query.error ===
                        "blocked-60"
                      ? "Too many incorrect attempts. Please wait 1 hour and try again."
                      : query.error ===
                          "rate-limit"
                        ? "We could not verify the access code right now. Please try again shortly."
                        : "That access code is incorrect."}
              </div>
            )}

            <label
              htmlFor="accessCode"
              style={{
                display:
                  "block",
                fontSize:
                  "14px",
                fontWeight:
                  "800",
                marginBottom:
                  "8px",
              }}
            >
              Access Code
            </label>

            <input
              id="accessCode"
              name="accessCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              minLength={4}
              maxLength={8}
              required
              autoComplete="off"
              placeholder="Enter access code"
              style={{
                width:
                  "100%",
                boxSizing:
                  "border-box",
                border:
                  "1px solid #d1d5db",
                borderRadius:
                  "11px",
                padding:
                  "14px 16px",
                fontSize:
                  "18px",
                letterSpacing:
                  "2px",
                outline:
                  "none",
                marginBottom:
                  "14px",
              }}
            />

            <button
              type="submit"
              style={{
                width:
                  "100%",
                background:
                  "#2563eb",
                color:
                  "#ffffff",
                border:
                  "none",
                borderRadius:
                  "11px",
                padding:
                  "15px 18px",
                fontSize:
                  "16px",
                fontWeight:
                  "800",
                cursor:
                  "pointer",
              }}
            >
              View Wishlist
            </button>
          </form>
        </section>
      </main>
    );
  }

  const [
    { data: gifts, error: giftsError },
    { data: reservations },
  ] = await Promise.all([
    admin
      .from("gifts")
      .select(
        "id, name, product_url, image_url, price, description, instructions, created_at"
      )
      .eq("wishlist_id", wishlist.id)
      .order("created_at", { ascending: false }),
    admin
      .from("reservations")
      .select("gift_id, tracking_number, receipt_url, order_url")
      .eq("wishlist_id", wishlist.id),
  ]);

  if (giftsError) {
    console.error("Public gifts error:", giftsError);
  }

  type ReservationRow = {
    gift_id: string;
    tracking_number:
      string | null;
    receipt_url:
      string | null;
    order_url:
      string | null;
  };

  const reservationRows =
    (reservations ||
      []) as ReservationRow[];

  const reservationByGift =
    new Map<
      string,
      ReservationRow
    >(
      reservationRows.map(
        (reservation) => [
          reservation.gift_id,
          reservation,
        ]
      )
    );

  const availableGifts =
    (gifts || []).filter(
      (gift) =>
        !reservationByGift.has(
          gift.id
        )
    );

  const reservedGifts =
    (gifts || []).filter(
      (gift) =>
        reservationByGift.has(
          gift.id
        )
    );

  type Gift =
    NonNullable<
      typeof gifts
    >[number];

  function renderGiftCard(
    gift: Gift,
    isReserved: boolean
  ) {
    const price =
      formatPrice(
        gift.price
      );

    const reservation =
      reservationByGift.get(
        gift.id
      );

    const hasReceiptOrTracking =
      Boolean(
        reservation?.tracking_number ||
          reservation?.receipt_url ||
          reservation?.order_url
      );

    return (
      <article
        key={gift.id}
        style={{
          background:
            "#ffffff",
          border:
            "1px solid #e5e7eb",
          borderRadius:
            "18px",
          overflow:
            "hidden",
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            height:
              "245px",
            background:
              "#f3f4f6",
            position:
              "relative",
            overflow:
              "hidden",
          }}
        >
          {gift.image_url ? (
            <img
              loading="lazy"
              decoding="async"
              src={
                gift.image_url
              }
              alt={
                gift.name
              }
              style={{
                width:
                  "100%",
                height:
                  "100%",
                objectFit:
                  "contain",
                background:
                  "#ffffff",
              }}
            />
          ) : (
            <div
              style={{
                width:
                  "100%",
                height:
                  "100%",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                color:
                  "#9ca3af",
                fontSize:
                  "14px",
                fontWeight:
                  "700",
              }}
            >
              Gift
            </div>
          )}

          {isReserved && (
            <>
              <div
                style={{
                  position:
                    "absolute",
                  top: "50%",
                  left: "50%",
                  transform:
                    "translate(-50%, -50%)",
                  width:
                    "62px",
                  height:
                    "62px",
                  borderRadius:
                    "50%",
                  background:
                    "#2563eb",
                  color:
                    "#ffffff",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize:
                    "34px",
                  fontWeight:
                    "900",
                  boxShadow:
                    "0 8px 24px rgba(37,99,235,0.35)",
                  border:
                    "4px solid #ffffff",
                  zIndex: 2,
                }}
              >
                ✓
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding:
              "22px",
          }}
        >
          <div
            style={{
              fontSize:
                "20px",
              fontWeight:
                "800",
              lineHeight:
                "1.3",
              marginBottom:
                price
                  ? "6px"
                  : "14px",
            }}
          >
            {gift.name}
          </div>

          {price && (
            <div
              style={{
                color:
                  "#2563eb",
                fontSize:
                  "17px",
                fontWeight:
                  "800",
                marginBottom:
                  "14px",
              }}
            >
              {price}
            </div>
          )}

          {gift.description && (
            <p
              style={{
                color:
                  "#6b7280",
                fontSize:
                  "14px",
                lineHeight:
                  "1.6",
                margin:
                  "0 0 14px",
                whiteSpace:
                  "pre-wrap",
              }}
            >
              {
                gift.description
              }
            </p>
          )}

          {gift.instructions && (
            <div
              style={{
                background:
                  "#f8fafc",
                border:
                  "1px solid #e5e7eb",
                borderRadius:
                  "10px",
                padding:
                  "12px",
                color:
                  "#4b5563",
                fontSize:
                  "13px",
                lineHeight:
                  "1.5",
                marginBottom:
                  "16px",
                whiteSpace:
                  "pre-wrap",
              }}
            >
              <strong>
                Notes:{" "}
              </strong>
              {
                gift.instructions
              }
            </div>
          )}

          {isReserved ? (
            <div
              style={{
                display:
                  "grid",
                gap: "10px",
              }}
            >
              <div
                style={{
                  background:
                    "#eff6ff",
                  color:
                    "#2563eb",
                  border:
                    "1px solid #bfdbfe",
                  borderRadius:
                    "11px",
                  padding:
                    "14px 16px",
                  textAlign:
                    "center",
                  fontSize:
                    "14px",
                  fontWeight:
                    "800",
                }}
              >
                ✓ Already Reserved
              </div>

              <Link
                href={`/wishlist/${activeWishlist.slug}/receipt/${gift.id}`}
                style={{
                  display:
                    "block",
                  textAlign:
                    "center",
                  background:
                    "#2563eb",
                  color:
                    "#ffffff",
                  border:
                    "1px solid #2563eb",
                  borderRadius:
                    "11px",
                  padding:
                    "13px 12px",
                  fontSize:
                    "14px",
                  fontWeight:
                    "800",
                  textDecoration:
                    "none",
                }}
              >
                {hasReceiptOrTracking
                  ? "Edit Receipt or Tracking"
                  : "Add Receipt or Tracking"}
              </Link>
            </div>
          ) : (
            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap:
                  "10px",
              }}
            >
              <a
                href={
                  getAffiliateUrl(
                    gift.product_url
                  )
                }
                target="_blank"
                rel="sponsored noreferrer"
                style={{
                  display:
                    "block",
                  textAlign:
                    "center",
                  background:
                    "#ffffff",
                  color:
                    "#2563eb",
                  border:
                    "1px solid #2563eb",
                  borderRadius:
                    "11px",
                  padding:
                    "13px 12px",
                  fontSize:
                    "14px",
                  fontWeight:
                    "800",
                  textDecoration:
                    "none",
                }}
              >
                View Store
              </a>

              <Link
                href={`/wishlist/${activeWishlist.slug}/reserve/${gift.id}`}
                style={{
                  display:
                    "block",
                  textAlign:
                    "center",
                  background:
                    "#2563eb",
                  color:
                    "#ffffff",
                  border:
                    "1px solid #2563eb",
                  borderRadius:
                    "11px",
                  padding:
                    "13px 12px",
                  fontSize:
                    "14px",
                  fontWeight:
                    "800",
                  textDecoration:
                    "none",
                }}
              >
                Reserve Gift
              </Link>
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",
        background:
          "#f8fafc",
        color:
          "#111827",
      }}
    >
      <header
        style={{
          background:
            "#ffffff",
          borderBottom:
            "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth:
              "1100px",
            margin:
              "0 auto",
            padding:
              "20px 30px",
            display:
              "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap:
              "20px",
          }}
        >
          <GoWishlistLogo
            href="/home"
            size={29}
          />

          {isOwner && (
            <Link
              href={`/dashboard/wishlist/${wishlist.id}`}
              style={{
                color:
                  "#2563eb",
                textDecoration:
                  "none",
                fontSize:
                  "14px",
                fontWeight:
                  "800",
              }}
            >
              Manage Wishlist
            </Link>
          )}
        </div>
      </header>

      <section
        style={{
          maxWidth:
            "1100px",
          margin:
            "0 auto",
          padding:
            "55px 30px 85px",
        }}
      >
        <div
          style={{
            textAlign:
              "center",
            marginBottom:
              "42px",
          }}
        >
          <div
            style={{
              color:
                "#2563eb",
              fontSize:
                "13px",
              fontWeight:
                "800",
              letterSpacing:
                "0.5px",
              marginBottom:
                "10px",
            }}
          >
            WISHLIST
          </div>

          <h1
            style={{
              margin: 0,
              fontSize:
                "44px",
              lineHeight:
                "1.1",
              fontWeight:
                "800",
              letterSpacing:
                "-1.8px",
            }}
          >
            {wishlist.title}
          </h1>

          <p
            style={{
              color:
                "#6b7280",
              fontSize:
                "15px",
              lineHeight:
                "1.6",
              margin:
                "12px auto 0",
              maxWidth:
                "560px",
            }}
          >
            Choose a gift below.
            Available gifts are shown
            first, and reserved gifts
            are kept in a separate
            section below.
          </p>
        </div>

        {!gifts ||
        gifts.length === 0 ? (
          <div
            style={{
              background:
                "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius:
                "20px",
              padding:
                "55px 30px",
              textAlign:
                "center",
              color:
                "#6b7280",
            }}
          >
            No gifts have been
            added yet.
          </div>
        ) : (
          <>
            <section>
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap:
                    "16px",
                  marginBottom:
                    "18px",
                }}
              >
                <div>
                  <div
                    style={{
                      color:
                        "#2563eb",
                      fontSize:
                        "12px",
                      fontWeight:
                        "900",
                      letterSpacing:
                        "1px",
                      marginBottom:
                        "5px",
                    }}
                  >
                    AVAILABLE
                  </div>

                  <h2
                    style={{
                      margin: 0,
                      fontSize:
                        "27px",
                      lineHeight:
                        "1.2",
                      fontWeight:
                        "800",
                      letterSpacing:
                        "-0.8px",
                    }}
                  >
                    Available Gifts
                  </h2>
                </div>

                <div
                  style={{
                    background:
                      "#eff6ff",
                    color:
                      "#2563eb",
                    borderRadius:
                      "999px",
                    padding:
                      "8px 12px",
                    fontSize:
                      "13px",
                    fontWeight:
                      "800",
                  }}
                >
                  {
                    availableGifts.length
                  }
                </div>
              </div>

              {availableGifts.length ===
              0 ? (
                <div
                  style={{
                    background:
                      "#ffffff",
                    border:
                      "1px solid #e5e7eb",
                    borderRadius:
                      "18px",
                    padding:
                      "34px 24px",
                    textAlign:
                      "center",
                    color:
                      "#6b7280",
                    fontSize:
                      "14px",
                  }}
                >
                  All gifts are currently
                  reserved.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
                    gap:
                      "20px",
                  }}
                >
                  {availableGifts.map(
                    (gift) =>
                      renderGiftCard(
                        gift,
                        false
                      )
                  )}
                </div>
              )}
            </section>

            {reservedGifts.length >
              0 && (
              <section
                style={{
                  marginTop:
                    "54px",
                  paddingTop:
                    "42px",
                  borderTop:
                    "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap:
                      "16px",
                    marginBottom:
                      "18px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color:
                          "#6b7280",
                        fontSize:
                          "12px",
                        fontWeight:
                          "900",
                        letterSpacing:
                          "1px",
                        marginBottom:
                          "5px",
                      }}
                    >
                      RESERVED
                    </div>

                    <h2
                      style={{
                        margin: 0,
                        fontSize:
                          "27px",
                        lineHeight:
                          "1.2",
                        fontWeight:
                          "800",
                        letterSpacing:
                          "-0.8px",
                      }}
                    >
                      Reserved Gifts
                    </h2>
                  </div>

                  <div
                    style={{
                      background:
                        "#eff6ff",
                      color:
                        "#2563eb",
                      borderRadius:
                        "999px",
                      padding:
                        "8px 12px",
                      fontSize:
                        "13px",
                      fontWeight:
                        "800",
                    }}
                  >
                    {
                      reservedGifts.length
                    }
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
                    gap:
                      "20px",
                  }}
                >
                  {reservedGifts.map(
                    (gift) =>
                      renderGiftCard(
                        gift,
                        true
                      )
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
