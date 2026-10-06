import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import GoWishlistLogo from "../../../../components/GoWishlistLogo";
import ConfirmDeleteGiftForm from "../../../../components/ConfirmDeleteGiftForm";
import NotificationsBell from "../../../../components/NotificationsBell";
import { createClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WishlistManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    data: wishlist,
    error: wishlistError,
  } = await supabase
    .from("wishlists")
    .select(
      "id, title, slug, is_live, access_code_hash, owner_contact_email, owner_contact_phone"
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (wishlistError || !wishlist) {
    notFound();
  }

  const [
    { data: gifts, error: giftsError },
    { data: reservations },
    { data: initialNotifications, count: notificationCount },
  ] = await Promise.all([
    supabase
      .from("gifts")
      .select(
        "id, name, product_url, image_url, price, description, shipping_address, instructions, created_at"
      )
      .eq("wishlist_id", wishlist.id)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("reservations")
      .select(
        "id, gift_id, reserver_name, reserver_email, reserver_phone, receipt_code, receipt_url, tracking_number, order_url, created_at"
      )
      .eq("wishlist_id", wishlist.id),
    supabase
      .from("notifications")
      .select(
        "id, wishlist_id, gift_id, reservation_id, type, title, message, read_at, created_at"
      )
      .eq("user_id", user.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const reservationByGift = new Map(
    (reservations || []).map((reservation) => [
      reservation.gift_id,
      reservation,
    ])
  );

  const notificationItems = initialNotifications || [];

  async function unreserveGift(formData: FormData) {
    "use server";

    const giftId = String(
      formData.get("giftId") || ""
    ).trim();

    if (!giftId) {
      return;
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: ownedWishlist } = await supabase
      .from("wishlists")
      .select("id, slug")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();

    if (!ownedWishlist) {
      notFound();
    }

    const { error } = await supabase
      .from("reservations")
      .delete()
      .eq("wishlist_id", ownedWishlist.id)
      .eq("gift_id", giftId);

    if (error) {
      console.error("Unreserve gift error:", error);
      return;
    }

    revalidatePath(
      `/dashboard/wishlist/${ownedWishlist.id}`
    );

    revalidatePath(
      `/wishlist/${ownedWishlist.slug}`
    );

    redirect(
      `/dashboard/wishlist/${ownedWishlist.id}`
    );
  }

  async function deleteGift(formData: FormData) {
    "use server";

    const giftId = String(
      formData.get("giftId") || ""
    ).trim();

    if (!giftId) {
      return;
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: ownedWishlist } = await supabase
      .from("wishlists")
      .select("id, slug")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();

    if (!ownedWishlist) {
      notFound();
    }

    const { data: reservation } = await supabase
      .from("reservations")
      .select("id")
      .eq("wishlist_id", ownedWishlist.id)
      .eq("gift_id", giftId)
      .maybeSingle();

    if (reservation) {
      redirect(
        `/dashboard/wishlist/${ownedWishlist.id}`
      );
    }

    const { error } = await supabase
      .from("gifts")
      .delete()
      .eq("id", giftId)
      .eq("wishlist_id", ownedWishlist.id)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Delete gift error:", error);
      return;
    }

    revalidatePath(
      `/dashboard/wishlist/${ownedWishlist.id}`
    );

    revalidatePath(
      `/wishlist/${ownedWishlist.slug}`
    );

    redirect(
      `/dashboard/wishlist/${ownedWishlist.id}`
    );
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
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
            padding: "20px 30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
          }}
        >
          <GoWishlistLogo
            href="/dashboard"
            size={29}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <NotificationsBell
              initialNotifications={notificationItems}
              initialUnreadCount={notificationCount || 0}
            />

            <Link
              href="/dashboard"
              style={{
                color: "#6b7280",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "50px 30px 90px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "24px",
            flexWrap: "wrap",
            marginBottom: "30px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  background: wishlist.is_live
                    ? "#dcfce7"
                    : "#f3f4f6",
                  color: wishlist.is_live
                    ? "#166534"
                    : "#4b5563",
                  borderRadius: "999px",
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: "800",
                }}
              >
                {wishlist.is_live ? "LIVE" : "DRAFT"}
              </span>

              {wishlist.access_code_hash && (
                <span
                  style={{
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    borderRadius: "999px",
                    padding: "6px 10px",
                    fontSize: "11px",
                    fontWeight: "800",
                  }}
                >
                  CODE PROTECTED
                </span>
              )}
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "42px",
                lineHeight: "1.1",
                letterSpacing: "-1.8px",
                fontWeight: "800",
              }}
            >
              {wishlist.title}
            </h1>

            <div
              style={{
                color: "#6b7280",
                fontSize: "14px",
                marginTop: "10px",
                wordBreak: "break-all",
              }}
            >
              /wishlist/{wishlist.slug}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            {wishlist.is_live && (
              <Link
                href={`/wishlist/${wishlist.slug}`}
                style={{
                  background: "#ffffff",
                  color: "#2563eb",
                  border: "1px solid #2563eb",
                  textDecoration: "none",
                  padding: "13px 18px",
                  borderRadius: "11px",
                  fontSize: "14px",
                  fontWeight: "800",
                }}
              >
                View Live Wishlist
              </Link>
            )}

            <Link
              href={`/dashboard/wishlist/${wishlist.id}/publish`}
              style={{
                background: wishlist.is_live
                  ? "#ffffff"
                  : "#2563eb",
                color: wishlist.is_live
                  ? "#111827"
                  : "#ffffff",
                border: wishlist.is_live
                  ? "1px solid #d1d5db"
                  : "1px solid #2563eb",
                textDecoration: "none",
                padding: "13px 18px",
                borderRadius: "11px",
                fontSize: "14px",
                fontWeight: "800",
              }}
            >
              {wishlist.is_live
                ? "Live Settings"
                : "Make Wishlist Live"}
            </Link>

            <Link
              href={`/dashboard/wishlist/${wishlist.id}/add`}
              style={{
                background: "#111827",
                color: "#ffffff",
                textDecoration: "none",
                padding: "13px 18px",
                borderRadius: "11px",
                fontSize: "14px",
                fontWeight: "800",
              }}
            >
              + Add Gift
            </Link>
          </div>
        </div>

        {wishlist.is_live && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "16px",
              padding: "18px",
              marginBottom: "30px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: "800",
                marginBottom: "5px",
              }}
            >
              Your wishlist is live
            </div>

            <div
              style={{
                color: "#6b7280",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              Guests can now view your wishlist and
              reserve available gifts.
            </div>
          </div>
        )}

        {giftsError && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              borderRadius: "14px",
              padding: "18px",
              fontWeight: "700",
            }}
          >
            We could not load your gifts.
          </div>
        )}

        {!giftsError &&
          (!gifts || gifts.length === 0) && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "20px",
                padding: "55px 30px",
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: "24px",
                  fontWeight: "800",
                }}
              >
                No gifts yet
              </h2>

              <p
                style={{
                  color: "#6b7280",
                  fontSize: "15px",
                  lineHeight: "1.6",
                  margin: "0 auto 24px",
                }}
              >
                Add your first gift from pasting a link
                from the store you want!
              </p>

              <Link
                href={`/dashboard/wishlist/${wishlist.id}/add`}
                style={{
                  display: "inline-block",
                  background: "#2563eb",
                  color: "#ffffff",
                  textDecoration: "none",
                  borderRadius: "11px",
                  padding: "13px 20px",
                  fontSize: "15px",
                  fontWeight: "800",
                }}
              >
                Add Your First Gift
              </Link>
            </div>
          )}

        {!giftsError &&
          gifts &&
          gifts.length > 0 && (
            <div
              style={{
                display: "grid",
                gap: "22px",
              }}
            >
              {gifts.map((gift) => {
                const reservation =
                  reservationByGift.get(gift.id);

                return (
                  <article
                    key={gift.id}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "20px",
                      overflow: "hidden",
                      boxShadow:
                        "0 10px 30px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(180px, 260px) 1fr",
                      }}
                    >
                      <div
                        style={{
                          minHeight: "260px",
                          background: "#f8fafc",
                          padding: "20px",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        {gift.image_url ? (
                          <img
                loading="lazy"
                decoding="async"
                            src={gift.image_url}
                            alt={gift.name}
                            style={{
                              width: "100%",
                              height: "220px",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              color: "#9ca3af",
                              fontWeight: "700",
                            }}
                          >
                            No image
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          padding: "26px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent:
                              "space-between",
                            gap: "16px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <h2
                              style={{
                                margin: 0,
                                fontSize: "22px",
                                fontWeight: "800",
                              }}
                            >
                              {gift.name}
                            </h2>

                            {gift.price !== null && (
                              <div
                                style={{
                                  color: "#2563eb",
                                  fontSize: "18px",
                                  fontWeight: "800",
                                  marginTop: "7px",
                                }}
                              >
                                $
                                {Number(
                                  gift.price
                                ).toLocaleString(
                                  "en-US",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </div>
                            )}
                          </div>

                          <span
                            style={{
                              alignSelf: "flex-start",
                              background: reservation
                                ? "#fef3c7"
                                : "#dcfce7",
                              color: reservation
                                ? "#92400e"
                                : "#166534",
                              borderRadius: "999px",
                              padding: "7px 10px",
                              fontSize: "11px",
                              fontWeight: "800",
                            }}
                          >
                            {reservation
                              ? "RESERVED"
                              : "AVAILABLE"}
                          </span>
                        </div>

                        {gift.description && (
                          <p
                            style={{
                              color: "#6b7280",
                              fontSize: "14px",
                              lineHeight: "1.6",
                              marginTop: "14px",
                            }}
                          >
                            {gift.description}
                          </p>
                        )}

                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                            marginTop: "18px",
                            marginBottom: "14px",
                          }}
                        >
                          <Link
                            href={`/dashboard/wishlist/${wishlist.id}/gift/${gift.id}/edit`}
                            style={{
                              background: "#ffffff",
                              color: "#2563eb",
                              border: "1px solid #2563eb",
                              borderRadius: "9px",
                              padding: "10px 14px",
                              fontSize: "13px",
                              fontWeight: "800",
                              textDecoration: "none",
                            }}
                          >
                            Edit Gift
                          </Link>

                          {!reservation && (
  <ConfirmDeleteGiftForm
    action={deleteGift}
    giftId={gift.id}
    giftName={gift.name}
  />
)}
                        </div>

                        <a
                          href={gift.product_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "#2563eb",
                            fontSize: "14px",
                            fontWeight: "800",
                            textDecoration: "none",
                          }}
                        >
                          View at Store →
                        </a>

                        {reservation && (
                          <div
                            style={{
                              marginTop: "24px",
                              borderTop:
                                "1px solid #e5e7eb",
                              paddingTop: "22px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "16px",
                                fontWeight: "800",
                                marginBottom: "16px",
                              }}
                            >
                              Reservation Details
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(190px, 1fr))",
                                gap: "14px",
                              }}
                            >
                              <InfoBox
                                label="Reserved By"
                                value={
                                  reservation.reserver_name
                                }
                              />

                              <InfoBox
                                label="Email"
                                value={
                                  reservation.reserver_email ||
                                  "Not provided"
                                }
                              />

                              <InfoBox
                                label="Phone"
                                value={
                                  reservation.reserver_phone ||
                                  "Not provided"
                                }
                              />

                              <InfoBox
                                label="Gift Receipt Code"
                                value={
                                  reservation.receipt_code
                                }
                              />

                              <InfoBox
                                label="Tracking Number"
                                value={
                                  reservation.tracking_number ||
                                  "Not added yet"
                                }
                              />
                            </div>

                            {(reservation.receipt_url ||
                              reservation.order_url) && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "10px",
                                  flexWrap: "wrap",
                                  marginTop: "16px",
                                }}
                              >
                                {reservation.receipt_url && (
                                  <a
                                    href={
                                      reservation.receipt_url
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      color: "#2563eb",
                                      fontSize: "14px",
                                      fontWeight: "800",
                                      textDecoration:
                                        "none",
                                    }}
                                  >
                                    View Receipt
                                  </a>
                                )}

                                {reservation.order_url && (
                                  <a
                                    href={
                                      reservation.order_url
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      color: "#2563eb",
                                      fontSize: "14px",
                                      fontWeight: "800",
                                      textDecoration:
                                        "none",
                                    }}
                                  >
                                    View Order
                                  </a>
                                )}
                              </div>
                            )}

                            <div
                              style={{
                                background: "#fef2f2",
                                border:
                                  "1px solid #fecaca",
                                borderRadius: "12px",
                                padding: "14px",
                                marginTop: "20px",
                              }}
                            >
                              <div
                                style={{
                                  color: "#991b1b",
                                  fontSize: "13px",
                                  fontWeight: "800",
                                  marginBottom: "5px",
                                }}
                              >
                                Gift Settings
                              </div>

                              <div
                                style={{
                                  color: "#7f1d1d",
                                  fontSize: "12px",
                                  lineHeight: "1.5",
                                  marginBottom: "12px",
                                }}
                              >
                                Unreserving this gift
                                makes it available for
                                someone else to reserve.
                              </div>

                              <form
                                action={unreserveGift}
                              >
                                <input
                                  type="hidden"
                                  name="giftId"
                                  value={gift.id}
                                />

                                <button
                                  type="submit"
                                  style={{
                                    background:
                                      "#ffffff",
                                    color: "#dc2626",
                                    border:
                                      "1px solid #dc2626",
                                    borderRadius:
                                      "9px",
                                    padding:
                                      "10px 14px",
                                    fontSize: "13px",
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
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
      </section>
    </main>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#f8fafc",
        borderRadius: "11px",
        padding: "13px",
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontSize: "10px",
          fontWeight: "800",
          letterSpacing: "0.5px",
          marginBottom: "5px",
        }}
      >
        {label.toUpperCase()}
      </div>

      <div
        style={{
          fontSize: "14px",
          fontWeight: "700",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}
