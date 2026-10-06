import Link from "next/link";
import { redirect } from "next/navigation";
import GoWishlistLogo from "../../components/GoWishlistLogo";
import NotificationsBell from "../../components/NotificationsBell";
import { getWishlistUrl } from "../../lib/site";
import { createClient } from "../../lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminEmail =
    process.env.ADMIN_EMAIL?.trim().toLowerCase();

  const isAdmin =
    Boolean(adminEmail) &&
    user.email?.trim().toLowerCase() === adminEmail;

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "there";

  const [
    { data: profile },
    { data: wishlists, error },
    { data: initialNotifications, count: notificationCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("wishlists")
      .select("id, title, slug, is_live, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
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

  const dashboardName =
    profile?.display_name?.trim() ||
    displayName;

  const dashboardFirstName =
    dashboardName.split(" ")[0];

  const notificationItems = initialNotifications || [];

  async function logOut() {
    "use server";

    const supabase =
      await createClient();

    await supabase.auth.signOut();

    redirect("/home");
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
            maxWidth: "1100px",
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
            href="/dashboard"
            size={29}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "18px",
            }}
          >
            {isAdmin && (
              <Link
                href="/admin"
                style={{
                  color: "#2563eb",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: "800",
                }}
              >
                Admin
              </Link>
            )}

            <NotificationsBell
              initialNotifications={notificationItems}
              initialUnreadCount={notificationCount || 0}
            />

            <Link
              href="/settings"
              style={{
                color: "#374151",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "700",
              }}
            >
              Settings
            </Link>

            <form action={logOut}>
              <button
                type="submit"
                style={{
                  background:
                    "transparent",
                  border: "none",
                  color: "#6b7280",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <section
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding:
            "55px 30px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "flex-end",
            gap: "20px",
            flexWrap: "wrap",
            marginBottom:
              "36px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "42px",
                lineHeight: "1.1",
                fontWeight: "800",
                letterSpacing:
                  "-1.8px",
              }}
            >
              Hi, {dashboardFirstName}
            </h1>

            <p
              style={{
                color: "#6b7280",
                fontSize: "16px",
                margin:
                  "10px 0 0",
              }}
            >
              Create, manage, and share
              your wishlists.
            </p>
          </div>

          <Link
            href="/dashboard/new"
            style={{
              display:
                "inline-block",
              background:
                "#2563eb",
              color: "#ffffff",
              textDecoration:
                "none",
              padding:
                "14px 20px",
              borderRadius:
                "11px",
              fontSize: "15px",
              fontWeight: "800",
              boxShadow:
                "0 8px 24px rgba(37,99,235,0.18)",
            }}
          >
            + New Wishlist
          </Link>
        </div>

        <div
          style={{
            fontSize: "18px",
            fontWeight: "800",
            marginBottom:
              "18px",
          }}
        >
          Your Wishlists
        </div>

        {error && (
          <div
            style={{
              background:
                "#fef2f2",
              border:
                "1px solid #fecaca",
              color: "#b91c1c",
              borderRadius:
                "14px",
              padding: "18px",
              fontWeight: "700",
            }}
          >
            We could not load your
            wishlists. Please refresh
            the page.
          </div>
        )}

        {!error &&
          (!wishlists ||
            wishlists.length ===
              0) && (
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
                boxShadow:
                  "0 12px 35px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  fontSize:
                    "24px",
                  fontWeight:
                    "800",
                  marginBottom:
                    "10px",
                }}
              >
                No wishlists yet
              </div>

              <p
                style={{
                  color:
                    "#6b7280",
                  fontSize:
                    "15px",
                  lineHeight:
                    "1.6",
                  margin:
                    "0 auto 24px",
                  maxWidth:
                    "430px",
                }}
              >
                Create your first
                GoWishlist and start
                adding gifts.
              </p>

              <Link
                href="/dashboard/new"
                style={{
                  display:
                    "inline-block",
                  background:
                    "#2563eb",
                  color:
                    "#ffffff",
                  textDecoration:
                    "none",
                  padding:
                    "13px 20px",
                  borderRadius:
                    "11px",
                  fontSize:
                    "15px",
                  fontWeight:
                    "800",
                }}
              >
                Create Wishlist
              </Link>
            </div>
          )}

        {!error &&
          wishlists &&
          wishlists.length >
            0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "18px",
              }}
            >
              {wishlists.map(
                (wishlist) => {
                  const publicUrl =
                    getWishlistUrl(
                      wishlist.slug
                    );

                  const displayUrl =
                    publicUrl.replace(
                      /^https?:\/\//,
                      ""
                    );

                  return (
                    <Link
                      key={
                        wishlist.id
                      }
                      href={`/dashboard/wishlist/${wishlist.id}`}
                      style={{
                        display:
                          "block",
                        background:
                          "#ffffff",
                        border:
                          "1px solid #e5e7eb",
                        borderRadius:
                          "18px",
                        padding:
                          "24px",
                        color:
                          "#111827",
                        textDecoration:
                          "none",
                        boxShadow:
                          "0 10px 30px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "flex-start",
                          gap: "12px",
                          marginBottom:
                            "18px",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              "20px",
                            lineHeight:
                              "1.25",
                            fontWeight:
                              "800",
                          }}
                        >
                          {
                            wishlist.title
                          }
                        </div>

                        <span
                          style={{
                            background:
                              wishlist.is_live
                                ? "#dcfce7"
                                : "#f3f4f6",
                            color:
                              wishlist.is_live
                                ? "#166534"
                                : "#4b5563",
                            borderRadius:
                              "999px",
                            padding:
                              "6px 9px",
                            fontSize:
                              "10px",
                            fontWeight:
                              "800",
                            letterSpacing:
                              "0.5px",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {wishlist.is_live
                            ? "LIVE"
                            : "DRAFT"}
                        </span>
                      </div>

                      <div
                        style={{
                          color:
                            "#6b7280",
                          fontSize:
                            "13px",
                          marginBottom:
                            "18px",
                          wordBreak:
                            "break-all",
                        }}
                      >
                        {displayUrl}
                      </div>

                      <div
                        style={{
                          borderTop:
                            "1px solid #f1f5f9",
                          paddingTop:
                            "16px",
                          color:
                            "#2563eb",
                          fontSize:
                            "14px",
                          fontWeight:
                            "800",
                        }}
                      >
                        Manage Wishlist →
                      </div>
                    </Link>
                  );
                }
              )}
            </div>
          )}
      </section>
    </main>
  );
}
