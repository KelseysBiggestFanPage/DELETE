"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Notification = {
  id: string;
  wishlist_id: string | null;
  gift_id: string | null;
  reservation_id: string | null;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function NotificationsBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: Notification[];
  initialUnreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/notifications", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Could not load notifications.");
        return;
      }

      setNotifications(
        Array.isArray(data.notifications) ? data.notifications : []
      );
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch {
      setError("Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) {
        void refreshNotifications();
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshNotifications]);

  function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      void refreshNotifications();
    }
  }

  async function markAsRead(id: string) {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", id }),
      });

      if (!response.ok) {
        return;
      }

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, read_at: new Date().toISOString() }
            : notification
        )
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setError("Could not update the notification.");
    }
  }

  async function markAllAsRead() {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error || "Could not mark notifications as read.");
        return;
      }

      const now = new Date().toISOString();

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at || now,
        }))
      );

      setUnreadCount(0);
    } catch {
      setError("Could not mark notifications as read.");
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
  type="button"
  onClick={toggleOpen}
  aria-label={
    unreadCount > 0
      ? `${unreadCount} unread notifications`
      : "Notifications"
  }
  aria-expanded={open}
  style={{
    position: "relative",
    width: "36px",
    height: "36px",
    border: "none",
    outline: "none",
    background: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    margin: 0,
  }}
>
  <Image
    src={unreadCount > 0 ? "/BellUnclear.png" : "/BellClear.png"}
    alt=""
    width={36}
    height={36}
    priority
    style={{
      display: "block",
      width: "36px",
      height: "36px",
      objectFit: "contain",
    }}
  />
</button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "50px",
            right: 0,
            width: "min(390px, calc(100vw - 32px))",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            boxShadow: "0 20px 60px rgba(17,24,39,0.16)",
            overflow: "hidden",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              padding: "17px 18px 14px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontSize: "17px", fontWeight: "900" }}>
                Notifications
              </div>

              <div
                style={{
                  marginTop: "3px",
                  color: "#6b7280",
                  fontSize: "12px",
                }}
              >
                {unreadCount > 0
                  ? `${unreadCount} new notification${
                      unreadCount === 1 ? "" : "s"
                    }`
                  : "You are all caught up."}
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#2563eb",
                  fontSize: "12px",
                  fontWeight: "800",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {loading && notifications.length === 0 && (
            <div
              style={{
                padding: "28px 18px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "13px",
              }}
            >
              Loading notifications…
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "12px 18px",
                color: "#b91c1c",
                background: "#fef2f2",
                fontSize: "12px",
                fontWeight: "700",
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && notifications.length === 0 && (
            <div
              style={{
                padding: "32px 18px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "28px",
                  marginBottom: "8px",
                }}
              >
                🎉
              </div>

              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "800",
                  color: "#111827",
                }}
              >
                No notifications yet
              </div>

              <div
                style={{
                  marginTop: "5px",
                  color: "#6b7280",
                  fontSize: "12px",
                  lineHeight: "1.5",
                }}
              >
                When someone reserves one of your gifts, it will show up here.
              </div>
            </div>
          )}

          {notifications.length > 0 && (
            <div
              style={{
                maxHeight: "430px",
                overflowY: "auto",
              }}
            >
              {notifications.map((notification) => {
                const notificationCard = (
                  <div
                    style={{
                      padding: "15px 18px",
                      background: notification.read_at
                        ? "#ffffff"
                        : "#eff6ff",
                      borderBottom: "1px solid #f1f5f9",
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "10px",
                        background: notification.read_at
                          ? "#f3f4f6"
                          : "#dbeafe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      🎁
                    </div>

                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "900",
                          color: "#111827",
                        }}
                      >
                        {notification.title}
                      </div>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#4b5563",
                          fontSize: "12px",
                          lineHeight: "1.5",
                        }}
                      >
                        {notification.message}
                      </div>

                      <div
                        style={{
                          marginTop: "7px",
                          color: "#9ca3af",
                          fontSize: "11px",
                        }}
                      >
                        {formatNotificationTime(notification.created_at)}
                      </div>
                    </div>
                  </div>
                );

                const wrappedCard = notification.wishlist_id ? (
                  <Link
                    href={`/dashboard/wishlist/${notification.wishlist_id}`}
                    onClick={() => {
                      if (!notification.read_at) {
                        void markAsRead(notification.id);
                      }

                      setOpen(false);
                    }}
                    style={{
                      color: "inherit",
                      textDecoration: "none",
                      display: "block",
                    }}
                  >
                    {notificationCard}
                  </Link>
                ) : (
                  notificationCard
                );

                return (
                  <div
                    key={notification.id}
                    style={{
                      position: "relative",
                    }}
                  >
                    {wrappedCard}

                    {!notification.read_at && (
                      <button
                        type="button"
                        onClick={() => void markAsRead(notification.id)}
                        aria-label="Mark notification as read"
                        style={{
                          position: "absolute",
                          top: "20px",
                          right: "18px",
                          width: "8px",
                          height: "8px",
                          padding: 0,
                          border: "none",
                          borderRadius: "50%",
                          background: "#2563eb",
                          cursor: "pointer",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
