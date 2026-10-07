import {
  createHmac,
  timingSafeEqual,
} from "crypto";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import GoWishlistLogo from "../../../../../components/GoWishlistLogo";
import {
  notFound,
  redirect,
} from "next/navigation";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { createClient } from "../../../../../lib/supabase/server";
import {
  createWishlistAccessToken,
  getWishlistAccessCookieName,
} from "../../../../../lib/wishlist-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createReceiptToken(
  reservationId: string,
  receiptCode: string
) {
  const secret =
    process.env.SUPABASE_SECRET_KEY;

  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY is missing."
    );
  }

  return createHmac("sha256", secret)
    .update(
      `${reservationId}:${receiptCode}`
    )
    .digest("hex");
}

const RECEIPT_ATTEMPTS_PER_TIER = 5;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function getBlockMinutes(
  failedAttempts: number
) {
  if (failedAttempts >= 15) {
    return 60;
  }

  if (failedAttempts >= 10) {
    return 15;
  }

  return 5;
}

function getBlockDurationMs(
  failedAttempts: number
) {
  if (failedAttempts >= 15) {
    return ONE_HOUR_MS;
  }

  if (failedAttempts >= 10) {
    return FIFTEEN_MINUTES_MS;
  }

  return FIVE_MINUTES_MS;
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

  return createHmac("sha256", secret)
    .update(
      `receipt:${ipAddress}`
    )
    .digest("hex");
}

function safeCompare(
  first: string,
  second: string
) {
  try {
    const a = Buffer.from(first);
    const b = Buffer.from(second);

    if (a.length !== b.length) {
      return false;
    }

    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const withProtocol =
    /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

export default async function GiftReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{
    slug: string;
    giftId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    forgot?: string;
  }>;
}) {
  const { slug, giftId } = await params;
  const query = await searchParams;

  const admin = createAdminClient();

  const { data: wishlistData } = await admin
    .from("wishlists")
    .select(
      "id, owner_id, title, slug, is_live, access_code_hash, owner_contact_email, owner_contact_phone"
    )
    .eq("slug", slug.toLowerCase())
    .eq("is_live", true)
    .maybeSingle();

  if (!wishlistData) {
    notFound();
  }

  const wishlist = wishlistData;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner =
    Boolean(user) &&
    user?.id === wishlist.owner_id;

  if (
    wishlist.access_code_hash &&
    !isOwner
  ) {
    const wishlistCookieStore =
      await cookies();

    const savedAccessToken =
      wishlistCookieStore.get(
        getWishlistAccessCookieName(
          wishlist.id
        )
      )?.value || "";

    const expectedAccessToken =
      createWishlistAccessToken(
        wishlist.id,
        wishlist.access_code_hash
      );

    if (
      !safeCompare(
        savedAccessToken,
        expectedAccessToken
      )
    ) {
      redirect(
        `/wishlist/${wishlist.slug}`
      );
    }
  }

  const { data: giftData } = await admin
    .from("gifts")
    .select(
      "id, wishlist_id, name, image_url, price, shipping_address"
    )
    .eq("id", giftId)
    .eq("wishlist_id", wishlist.id)
    .maybeSingle();

  if (!giftData) {
    notFound();
  }

  const gift = giftData;

  const { data: reservationData } =
    await admin
      .from("reservations")
      .select(
        "id, gift_id, receipt_code, tracking_number, receipt_url, order_url"
      )
      .eq("gift_id", gift.id)
      .eq("wishlist_id", wishlist.id)
      .maybeSingle();

  if (!reservationData) {
    notFound();
  }

  const reservation = reservationData;

  const cookieStore = await cookies();

  const cookieName =
    `gift_receipt_${reservation.id}`;

  const expectedToken =
    createReceiptToken(
      reservation.id,
      reservation.receipt_code
    );

  const currentToken =
    cookieStore.get(cookieName)?.value || "";

  const unlocked = safeCompare(
    currentToken,
    expectedToken
  );

  async function unlockReceipt(
    formData: FormData
  ) {
    "use server";

    const submittedCode = String(
      formData.get("receiptCode") || ""
    )
      .replace(/\D/g, "")
      .slice(0, 4);

    if (!/^[0-9]{4}$/.test(submittedCode)) {
      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=code`
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
      requestHeaders
        .get("x-real-ip") ||
      requestHeaders
        .get("cf-connecting-ip") ||
      "unknown";

    const visitorKey =
      createVisitorKey(
        ipAddress
      );

    const admin = createAdminClient();

    const {
      data: attemptRecord,
      error: attemptReadError,
    } = await admin
      .from(
        "receipt_unlock_attempts"
      )
      .select(
        "id, failed_attempts, blocked_until"
      )
      .eq(
        "reservation_id",
        reservation.id
      )
      .eq(
        "visitor_key",
        visitorKey
      )
      .maybeSingle();

    if (attemptReadError) {
      console.error(
        "Receipt rate limit read error:",
        attemptReadError
      );

      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=rate-limit`
      );
    }

    const now = new Date();

    if (
      attemptRecord?.blocked_until &&
      new Date(
        attemptRecord.blocked_until
      ).getTime() > now.getTime()
    ) {
      const blockMinutes =
        getBlockMinutes(
          attemptRecord.failed_attempts
        );

      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=blocked-${blockMinutes}`
      );
    }

    const { data: currentReservation } =
      await admin
        .from("reservations")
        .select(
          "id, receipt_code"
        )
        .eq("id", reservation.id)
        .eq("gift_id", gift.id)
        .maybeSingle();

    const codeIsCorrect =
      Boolean(
        currentReservation
      ) &&
      safeCompare(
        submittedCode,
        currentReservation?.receipt_code ||
          ""
      );

    if (!codeIsCorrect) {
      const nextFailedAttempts =
        (
          attemptRecord?.failed_attempts ||
          0
        ) + 1;

      const shouldBlock =
        nextFailedAttempts %
          RECEIPT_ATTEMPTS_PER_TIER ===
        0;

      const blockMinutes =
        shouldBlock
          ? getBlockMinutes(
              nextFailedAttempts
            )
          : 0;

      const blockedUntil =
        shouldBlock
          ? new Date(
              now.getTime() +
                getBlockDurationMs(
                  nextFailedAttempts
                )
            ).toISOString()
          : null;

      const { error: attemptSaveError } =
        await admin
          .from(
            "receipt_unlock_attempts"
          )
          .upsert(
            {
              reservation_id:
                reservation.id,
              visitor_key:
                visitorKey,
              failed_attempts:
                nextFailedAttempts,
              blocked_until:
                blockedUntil,
              updated_at:
                now.toISOString(),
            },
            {
              onConflict:
                "reservation_id,visitor_key",
            }
          );

      if (attemptSaveError) {
        console.error(
          "Receipt rate limit save error:",
          attemptSaveError
        );

        redirect(
          `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=rate-limit`
        );
      }

      if (shouldBlock) {
        redirect(
          `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=blocked-${blockMinutes}`
        );
      }

      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=code`
      );
    }

    const { error: clearAttemptsError } =
      await admin
        .from(
          "receipt_unlock_attempts"
        )
        .delete()
        .eq(
          "reservation_id",
          reservation.id
        )
        .eq(
          "visitor_key",
          visitorKey
        );

    if (clearAttemptsError) {
      console.error(
        "Receipt rate limit clear error:",
        clearAttemptsError
      );
    }

    const token =
      createReceiptToken(
        currentReservation!.id,
        currentReservation!.receipt_code
      );

    const cookieStore = await cookies();

    cookieStore.set(
      `gift_receipt_${currentReservation!.id}`,
      token,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path:
          `/wishlist/${wishlist.slug}/receipt/${gift.id}`,
        maxAge: 60 * 60 * 24 * 7,
      }
    );

    redirect(
      `/wishlist/${wishlist.slug}/receipt/${gift.id}`
    );
  }

  async function saveReceiptInfo(
    formData: FormData
  ) {
    "use server";

    const cookieStore = await cookies();

    const currentToken =
      cookieStore.get(
        `gift_receipt_${reservation.id}`
      )?.value || "";

    const expectedToken =
      createReceiptToken(
        reservation.id,
        reservation.receipt_code
      );

    if (
      !safeCompare(
        currentToken,
        expectedToken
      )
    ) {
      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=session`
      );
    }

    const trackingNumber = String(
      formData.get("trackingNumber") || ""
    )
      .trim()
      .slice(0, 120);

    const rawOrderUrl = String(
      formData.get("orderUrl") || ""
    ).trim();

    const rawReceiptUrl = String(
      formData.get("receiptUrl") || ""
    ).trim();

    const orderUrl =
      rawOrderUrl
        ? normalizeUrl(rawOrderUrl)
        : "";

    const receiptUrl =
      rawReceiptUrl
        ? normalizeUrl(rawReceiptUrl)
        : "";

    if (rawOrderUrl && !orderUrl) {
      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=order`
      );
    }

    if (
      rawReceiptUrl &&
      !receiptUrl
    ) {
      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=receipt`
      );
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("reservations")
      .update({
        tracking_number:
          trackingNumber || null,
        order_url:
          orderUrl || null,
        receipt_url:
          receiptUrl || null,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", reservation.id)
      .eq("gift_id", gift.id);

    if (error) {
      console.error(
        "Save receipt information error:",
        error
      );

      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=save`
      );
    }

    cookieStore.set(
      `gift_receipt_${reservation.id}`,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path:
          `/wishlist/${wishlist.slug}/receipt/${gift.id}`,
        maxAge: 0,
      }
    );

    redirect(
      `/wishlist/${wishlist.slug}`
    );
  }

  async function unreserveGift() {
    "use server";

    const cookieStore = await cookies();

    const admin = createAdminClient();

    const { data: currentReservation } =
      await admin
        .from("reservations")
        .select("id, receipt_code")
        .eq("id", reservation.id)
        .eq("gift_id", gift.id)
        .eq("wishlist_id", wishlist.id)
        .maybeSingle();

    if (!currentReservation) {
      redirect(
        `/wishlist/${wishlist.slug}`
      );
    }

    const currentToken =
      cookieStore.get(
        `gift_receipt_${currentReservation.id}`
      )?.value || "";

    const expectedToken =
      createReceiptToken(
        currentReservation.id,
        currentReservation.receipt_code
      );

    if (
      !safeCompare(
        currentToken,
        expectedToken
      )
    ) {
      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=session`
      );
    }

    const { error: deleteError } =
      await admin
        .from("reservations")
        .delete()
        .eq("id", currentReservation.id)
        .eq("gift_id", gift.id)
        .eq("wishlist_id", wishlist.id);

    if (deleteError) {
      console.error(
        "Guest unreserve error:",
        deleteError
      );

      redirect(
        `/wishlist/${wishlist.slug}/receipt/${gift.id}?error=unreserve`
      );
    }

    cookieStore.set(
      `gift_receipt_${currentReservation.id}`,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path:
          `/wishlist/${wishlist.slug}/receipt/${gift.id}`,
        maxAge: 0,
      }
    );

    redirect(
      `/wishlist/${wishlist.slug}`
    );
  }

  let errorMessage = "";

  if (query.error === "code") {
    errorMessage =
      "That Gift Receipt Code is incorrect.";
  }

  if (query.error === "session") {
    errorMessage =
      "Enter your Gift Receipt Code again to continue.";
  }

  if (query.error === "order") {
    errorMessage =
      "Enter a valid order or Amazon link.";
  }

  if (query.error === "receipt") {
    errorMessage =
      "Enter a valid receipt link.";
  }

  if (query.error === "save") {
    errorMessage =
      "We could not save your information. Please try again.";
  }

  if (query.error === "unreserve") {
    errorMessage =
      "We could not unreserve this gift. Please try again.";
  }

  if (query.error === "blocked-5") {
    errorMessage =
      "Too many incorrect code attempts. Please wait 5 minutes and try again.";
  }

  if (query.error === "blocked-15") {
    errorMessage =
      "Too many incorrect code attempts. Please wait 15 minutes and try again.";
  }

  if (query.error === "blocked-60") {
    errorMessage =
      "Too many incorrect code attempts. Please wait 1 hour and try again.";
  }

  if (query.error === "rate-limit") {
    errorMessage =
      "We could not verify your Gift Receipt Code right now. Please try again shortly.";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#111827",
      }}
    >
      <header
        style={{
          background: "#ffffff",
          borderBottom:
            "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            padding: "20px 30px",
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <GoWishlistLogo
            href="/home"
            size={29}
          />

          <Link
            href={`/wishlist/${wishlist.slug}`}
            style={{
              color: "#6b7280",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "700",
            }}
          >
            Back to Wishlist
          </Link>
        </div>
      </header>

      <section
        style={{
          maxWidth: "620px",
          margin: "0 auto",
          padding: "55px 30px 90px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          {gift.image_url && (
            <div
              style={{
                width: "130px",
                height: "130px",
                background: "#ffffff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: "18px",
                padding: "12px",
                margin:
                  "0 auto 20px",
              }}
            >
              <img
                src={gift.image_url}
                alt={gift.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit:
                    "contain",
                }}
              />
            </div>
          )}

          <div
            style={{
              color: "#2563eb",
              fontSize: "13px",
              fontWeight: "800",
              marginBottom: "7px",
            }}
          >
            {wishlist.title}
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "35px",
              lineHeight: "1.15",
              letterSpacing:
                "-1.4px",
              fontWeight: "800",
            }}
          >
            Gift Receipt & Tracking
          </h1>

          <p
            style={{
              color: "#6b7280",
              fontSize: "15px",
              lineHeight: "1.6",
              margin:
                "12px 0 0",
            }}
          >
            {gift.name}
          </p>
        </div>

        {!unlocked ? (
          <div
            style={{
              background: "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: "20px",
              padding: "30px",
              boxShadow:
                "0 15px 40px rgba(0,0,0,0.06)",
            }}
          >
            <form
              action={unlockReceipt}
            >
              <label
                htmlFor="receiptCode"
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "800",
                  marginBottom: "8px",
                }}
              >
                Gift Receipt Code
              </label>

              <input
                id="receiptCode"
                name="receiptCode"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                placeholder="4-digit code"
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  border:
                    "1px solid #d1d5db",
                  borderRadius: "11px",
                  padding:
                    "15px 16px",
                  fontSize: "22px",
                  fontWeight: "800",
                  letterSpacing: "6px",
                  textAlign: "center",
                  outline: "none",
                  marginBottom: "12px",
                }}
              />

              {errorMessage && (
                <div
                  style={{
                    background:
                      "#fef2f2",
                    border:
                      "1px solid #fecaca",
                    color: "#b91c1c",
                    borderRadius: "11px",
                    padding:
                      "12px 14px",
                    fontSize: "13px",
                    fontWeight: "700",
                    marginBottom: "14px",
                  }}
                >
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                style={{
                  width: "100%",
                  background:
                    "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "11px",
                  padding:
                    "15px 18px",
                  fontSize: "16px",
                  fontWeight: "800",
                  cursor: "pointer",
                }}
              >
                Continue
              </button>
            </form>

            <div
              style={{
                borderTop:
                  "1px solid #e5e7eb",
                marginTop: "24px",
                paddingTop: "20px",
              }}
            >
              <Link
                href={`/wishlist/${wishlist.slug}/receipt/${gift.id}?forgot=1`}
                style={{
                  color: "#2563eb",
                  fontSize: "14px",
                  fontWeight: "800",
                  textDecoration: "none",
                }}
              >
                Forgot Your Gift Receipt Code?
              </Link>

              {query.forgot === "1" && (
                <div
                  style={{
                    background:
                      "#f8fafc",
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "16px",
                    marginTop: "14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "800",
                      marginBottom: "7px",
                    }}
                  >
                    Contact the wishlist owner
                  </div>

                  <div
                    style={{
                      color: "#6b7280",
                      fontSize: "13px",
                      lineHeight: "1.55",
                      marginBottom: "10px",
                    }}
                  >
                    GoWishlist cannot recover
                    your Gift Receipt Code.
                    Contact the wishlist
                    owner to get your code.
                  </div>

                  {wishlist.owner_contact_email && (
                    <div
                      style={{
                        fontSize:
                          "14px",
                        marginTop:
                          "7px",
                      }}
                    >
                      <strong>
                        Email:
                      </strong>{" "}
                      <a
                        href={`mailto:${wishlist.owner_contact_email}`}
                        style={{
                          color:
                            "#2563eb",
                        }}
                      >
                        {
                          wishlist.owner_contact_email
                        }
                      </a>
                    </div>
                  )}

                  {wishlist.owner_contact_phone && (
                    <div
                      style={{
                        fontSize:
                          "14px",
                        marginTop:
                          "7px",
                      }}
                    >
                      <strong>
                        Phone:
                      </strong>{" "}
                      <a
                        href={`tel:${wishlist.owner_contact_phone}`}
                        style={{
                          color:
                            "#2563eb",
                        }}
                      >
                        {
                          wishlist.owner_contact_phone
                        }
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {gift.shipping_address && (
              <div
                style={{
                  background: "#eff6ff",
                  border:
                    "1px solid #bfdbfe",
                  borderRadius: "16px",
                  padding: "18px",
                  color: "#1e3a8a",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  marginBottom: "22px",
                }}
              >
                <div
                  style={{
                    fontWeight: "800",
                    marginBottom: "6px",
                  }}
                >
                  Shipping Address
                </div>

                {gift.shipping_address}

                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "#2563eb",
                  }}
                >
                  This address is available only after
                  unlocking your Gift Receipt.
                </div>
              </div>
            )}

            <form
              action={saveReceiptInfo}
              style={{
                background: "#ffffff",
                border:
                  "1px solid #e5e7eb",
                borderRadius: "20px",
                padding: "30px",
                boxShadow:
                  "0 15px 40px rgba(0,0,0,0.06)",
              }}
            >
              {query.saved === "1" && (
                <div
                  style={{
                    background:
                      "#f0fdf4",
                    border:
                      "1px solid #bbf7d0",
                    color: "#166534",
                    borderRadius: "11px",
                    padding:
                      "13px 14px",
                    fontSize: "14px",
                    fontWeight: "700",
                    marginBottom: "22px",
                  }}
                >
                  Gift information saved.
                </div>
              )}

              {errorMessage && (
                <div
                  style={{
                    background:
                      "#fef2f2",
                    border:
                      "1px solid #fecaca",
                    color: "#b91c1c",
                    borderRadius: "11px",
                    padding:
                      "13px 14px",
                    fontSize: "14px",
                    fontWeight: "700",
                    marginBottom: "22px",
                  }}
                >
                  {errorMessage}
                </div>
              )}

              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "800",
                  marginBottom: "8px",
                }}
              >
                Tracking Number
              </label>

              <input
                name="trackingNumber"
                defaultValue={
                  reservation.tracking_number ||
                  ""
                }
                placeholder="Tracking number"
                maxLength={120}
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  border:
                    "1px solid #d1d5db",
                  borderRadius: "11px",
                  padding: "14px 16px",
                  fontSize: "16px",
                  outline: "none",
                  marginBottom: "24px",
                }}
              />

              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "800",
                  marginBottom: "8px",
                }}
              >
                Amazon or Order Link
              </label>

              <input
                name="orderUrl"
                defaultValue={
                  reservation.order_url ||
                  ""
                }
                placeholder="amazon.com/your-order-link"
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  border:
                    "1px solid #d1d5db",
                  borderRadius: "11px",
                  padding: "14px 16px",
                  fontSize: "16px",
                  outline: "none",
                  marginBottom: "24px",
                }}
              />

              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "800",
                  marginBottom: "8px",
                }}
              >
                Receipt Link
              </label>

              <input
                name="receiptUrl"
                defaultValue={
                  reservation.receipt_url ||
                  ""
                }
                placeholder="Link to your receipt"
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  border:
                    "1px solid #d1d5db",
                  borderRadius: "11px",
                  padding: "14px 16px",
                  fontSize: "16px",
                  outline: "none",
                  marginBottom: "26px",
                }}
              />

              <button
                type="submit"
                style={{
                  width: "100%",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "11px",
                  padding: "15px 18px",
                  fontSize: "16px",
                  fontWeight: "800",
                  cursor: "pointer",
                }}
              >
                Save Gift Information
              </button>
            </form>

            <div
              style={{
                background: "#ffffff",
                border:
                  "1px solid #fecaca",
                borderRadius: "20px",
                padding: "24px",
                marginTop: "22px",
              }}
            >
              <div
                style={{
                  color: "#991b1b",
                  fontSize: "17px",
                  fontWeight: "800",
                  marginBottom: "7px",
                }}
              >
                Need to change your mind?
              </div>

              <p
                style={{
                  color: "#6b7280",
                  fontSize: "13px",
                  lineHeight: "1.55",
                  margin: "0 0 16px",
                }}
              >
                Unreserving this gift makes it
                available for someone else to
                reserve. Your receipt and tracking
                information for this reservation
                will also be removed.
              </p>

              <form
                action={unreserveGift}
              >
                <button
                  type="submit"
                  style={{
                    width: "100%",
                    background: "#ffffff",
                    color: "#dc2626",
                    border:
                      "1px solid #dc2626",
                    borderRadius: "11px",
                    padding: "14px 18px",
                    fontSize: "14px",
                    fontWeight: "800",
                    cursor: "pointer",
                  }}
                >
                  Unreserve Gift
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
