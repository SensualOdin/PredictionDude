import webpush from "web-push";
import { db } from "@/lib/db";
import { settings, alerts } from "@/lib/db/schema";

// Configure VAPID
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:george@predictiondude.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(
  payload: PushPayload,
  alertData?: { recommendationId: string; type: string }
): Promise<boolean> {
  try {
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[Push] VAPID keys not configured, skipping push");
      return false;
    }

    // Get the push subscription from settings
    const rows = await db.select().from(settings).limit(1);
    const userSettings = rows[0];

    if (!userSettings?.pushEnabled || !userSettings?.pushSubscription) {
      return false;
    }

    const subscription =
      userSettings.pushSubscription as unknown as webpush.PushSubscription;

    await webpush.sendNotification(subscription, JSON.stringify(payload));

    // Log to alerts table
    if (alertData) {
      await db.insert(alerts).values({
        recommendationId: alertData.recommendationId,
        type: alertData.type,
        title: payload.title,
        body: payload.body,
      });
    }

    return true;
  } catch (error) {
    console.error("[Push] Failed to send notification:", error);
    return false;
  }
}
