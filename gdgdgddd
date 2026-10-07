import { createHmac } from "crypto";
import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { createClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SUBMISSIONS_PER_HOUR = 5;
const SUPPORT_WINDOW_SECONDS = 3600;

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
      `support:${ipAddress}`
    )
    .digest("hex");
}

function isValidEmail(
  email: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

export async function GET() {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          loggedIn: false,
          name: "",
          email: "",
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

    const fallbackName =
      user.user_metadata
        ?.full_name ||
      user.user_metadata
        ?.name ||
      "";

    return NextResponse.json(
      {
        loggedIn: true,
        name:
          profile?.display_name ||
          fallbackName ||
          "",
        email:
          user.email || "",
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Support profile error:",
      error
    );

    return NextResponse.json(
      {
        loggedIn: false,
        name: "",
        email: "",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    let name = String(
      body?.name || ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 120);

    let email = String(
      body?.email || ""
    )
      .trim()
      .toLowerCase()
      .slice(0, 320);

    const message = String(
      body?.message || ""
    )
      .trim()
      .slice(0, 5000);

    const sourcePath = String(
      body?.sourcePath || ""
    )
      .trim()
      .slice(0, 500);

    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (user) {
      const { data: profile } =
        await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();

      if (!name) {
        name =
          profile?.display_name ||
          user.user_metadata
            ?.full_name ||
          user.user_metadata
            ?.name ||
          "";
      }

      if (user.email) {
        email =
          user.email
            .trim()
            .toLowerCase();
      }
    }

    if (
      name.length < 1 ||
      name.length > 120
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter your name.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !email ||
      !isValidEmail(email)
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid email address.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      message.length < 5
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter a message.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      message.length > 5000
    ) {
      return NextResponse.json(
        {
          error:
            "Your message is too long.",
        },
        {
          status: 400,
        }
      );
    }

    const forwardedFor =
      request.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim() || "";

    const ipAddress =
      forwardedFor ||
      request.headers.get(
        "x-real-ip"
      ) ||
      request.headers.get(
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
        "Support visitor key error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Support is temporarily unavailable. Please try again.",
        },
        {
          status: 503,
        }
      );
    }

    const admin =
      createAdminClient();

    const {
      data: rateLimitAllowed,
      error: rateLimitError,
    } = await admin.rpc(
      "check_support_submission_rate_limit",
      {
        p_visitor_key:
          visitorKey,
        p_limit:
          MAX_SUBMISSIONS_PER_HOUR,
        p_window_seconds:
          SUPPORT_WINDOW_SECONDS,
      }
    );

    if (rateLimitError) {
      console.error(
        "Support rate limit error:",
        rateLimitError
      );

      return NextResponse.json(
        {
          error:
            "Support is temporarily unavailable. Please try again.",
        },
        {
          status: 503,
        }
      );
    }

    if (!rateLimitAllowed) {
      return NextResponse.json(
        {
          error:
            "Too many support messages were submitted. Please try again in about an hour.",
        },
        {
          status: 429,
          headers: {
            "Retry-After":
              String(
                SUPPORT_WINDOW_SECONDS
              ),
          },
        }
      );
    }

    const now =
      new Date().toISOString();

    const {
      error: ticketError,
    } = await admin
      .from(
        "support_tickets"
      )
      .insert({
        user_id:
          user?.id || null,
        name,
        email,
        message,
        status: "new",
        source_path:
          sourcePath || null,
        created_at: now,
        updated_at: now,
      });

    if (ticketError) {
      console.error(
        "Support ticket insert error:",
        ticketError
      );

      return NextResponse.json(
        {
          error:
            "We could not send your message. Please try again.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Support submission error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "We could not send your message. Please try again.",
      },
      {
        status: 500,
      }
    );
  }
}
