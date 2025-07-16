import { db } from "~/server/db";
import { userRequests } from "~/server/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export async function checkAndRecordRateLimit({
  db,
  userId,
  isAdmin,
  maxRequestsPerDay = 100,
}: {
  db: any;
  userId: string;
  isAdmin: boolean;
  maxRequestsPerDay?: number;
}): Promise<void> {
  if (isAdmin) return;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);
  const result = await db
    .select({ count: sql`count(*)::int` })
    .from(userRequests)
    .where(
      and(
        eq(userRequests.userId, userId),
        gte(userRequests.requestedAt, startOfDay),
        lte(userRequests.requestedAt, endOfDay),
      ),
    );
  const count = (result[0]?.count as number) ?? 0;
  if (count >= maxRequestsPerDay) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }
  await db.insert(userRequests).values({ userId });
}
