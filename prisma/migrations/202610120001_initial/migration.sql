-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('U', 'UA', 'A');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'BOOKED');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'CONFIRMED', 'EXPIRED', 'RELEASED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movie" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT,
    "language" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "rating" "Rating" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Show" (
    "id" UUID NOT NULL,
    "movieId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "ticketPricePaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowSeat" (
    "id" UUID NOT NULL,
    "showId" UUID NOT NULL,
    "rowLabel" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentHoldId" UUID,
    "currentBookingId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ShowSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatHold" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "showId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SeatHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoldSeat" (
    "holdId" UUID NOT NULL,
    "showSeatId" UUID NOT NULL,

    CONSTRAINT "HoldSeat_pkey" PRIMARY KEY ("holdId","showSeatId")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "showId" UUID NOT NULL,
    "holdId" UUID NOT NULL,
    "totalAmountPaise" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSeat" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "showSeatId" UUID NOT NULL,
    "seatPricePaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" UUID NOT NULL,
    "holdId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "outcome" "PaymentOutcome" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Movie_title_idx" ON "Movie"("title");

-- CreateIndex
CREATE INDEX "Show_movieId_startsAt_idx" ON "Show"("movieId", "startsAt");

-- CreateIndex
CREATE INDEX "ShowSeat_currentHoldId_idx" ON "ShowSeat"("currentHoldId");

-- CreateIndex
CREATE INDEX "ShowSeat_currentBookingId_idx" ON "ShowSeat"("currentBookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowSeat_showId_rowLabel_seatNumber_key" ON "ShowSeat"("showId", "rowLabel", "seatNumber");

-- CreateIndex
CREATE INDEX "SeatHold_status_expiresAt_idx" ON "SeatHold"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "SeatHold_userId_idx" ON "SeatHold"("userId");

-- CreateIndex
CREATE INDEX "SeatHold_showId_idx" ON "SeatHold"("showId");

-- CreateIndex
CREATE INDEX "HoldSeat_showSeatId_idx" ON "HoldSeat"("showSeatId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_holdId_key" ON "Booking"("holdId");

-- CreateIndex
CREATE INDEX "Booking_userId_createdAt_idx" ON "Booking"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_showId_status_idx" ON "Booking"("showId", "status");

-- CreateIndex
CREATE INDEX "BookingSeat_showSeatId_idx" ON "BookingSeat"("showSeatId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSeat_bookingId_showSeatId_key" ON "BookingSeat"("bookingId", "showSeatId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_holdId_idx" ON "PaymentAttempt"("holdId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_userId_idx" ON "PaymentAttempt"("userId");

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_currentHoldId_fkey" FOREIGN KEY ("currentHoldId") REFERENCES "SeatHold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_currentBookingId_fkey" FOREIGN KEY ("currentBookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldSeat" ADD CONSTRAINT "HoldSeat_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "SeatHold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoldSeat" ADD CONSTRAINT "HoldSeat_showSeatId_fkey" FOREIGN KEY ("showSeatId") REFERENCES "ShowSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "SeatHold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_showSeatId_fkey" FOREIGN KEY ("showSeatId") REFERENCES "ShowSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "SeatHold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-authored integrity rules; keep alongside Prisma's generated DDL.
ALTER TABLE "User" ADD CONSTRAINT "User_normalized_email" CHECK (email = lower(btrim(email)) AND length(btrim(name)) > 0);
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_valid_fields" CHECK (length(btrim(title)) > 0 AND length(btrim(language)) > 0 AND "durationMinutes" BETWEEN 1 AND 600);
ALTER TABLE "Show" ADD CONSTRAINT "Show_valid_schedule" CHECK ("durationMinutes" BETWEEN 1 AND 600 AND "endsAt" = "startsAt" + "durationMinutes" * interval '1 minute' AND "ticketPricePaise" BETWEEN 1 AND 10000000);
ALTER TABLE "Show" ADD CONSTRAINT "Show_no_overlap" EXCLUDE USING gist (tstzrange("startsAt", "endsAt", '[)') WITH &&);
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_valid_position" CHECK ("rowLabel" IN ('A','B','C','D','E','F','G','H') AND "seatNumber" BETWEEN 1 AND 10);
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_consistent_state" CHECK (
  (status = 'AVAILABLE' AND "currentHoldId" IS NULL AND "currentBookingId" IS NULL) OR
  (status = 'HELD' AND "currentHoldId" IS NOT NULL AND "currentBookingId" IS NULL) OR
  (status = 'BOOKED' AND "currentBookingId" IS NOT NULL AND "currentHoldId" IS NULL)
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_positive_total" CHECK ("totalAmountPaise" > 0);
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_positive_price" CHECK ("seatPricePaise" > 0);
CREATE FUNCTION verify_show_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
  IF TG_TABLE_NAME = 'Show' THEN target := COALESCE(NEW.id, OLD.id);
  ELSE target := COALESCE(NEW."showId", OLD."showId"); END IF;
  IF EXISTS (SELECT 1 FROM "Show" WHERE id = target) AND (SELECT count(*) FROM "ShowSeat" WHERE "showId" = target) <> 80 THEN
    RAISE EXCEPTION 'A show must have exactly 80 seats' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER show_inventory AFTER INSERT OR UPDATE ON "Show" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_show_inventory();
CREATE CONSTRAINT TRIGGER seat_inventory AFTER INSERT OR UPDATE OR DELETE ON "ShowSeat" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_show_inventory();
CREATE FUNCTION verify_hold_items() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; n integer;
BEGIN
  IF TG_TABLE_NAME = 'SeatHold' THEN target := COALESCE(NEW.id, OLD.id);
  ELSE target := COALESCE(NEW."holdId", OLD."holdId"); END IF;
  IF EXISTS (SELECT 1 FROM "SeatHold" WHERE id = target) THEN
    SELECT count(*) INTO n FROM "HoldSeat" WHERE "holdId" = target;
    IF n < 1 OR n > 6 THEN RAISE EXCEPTION 'A hold must contain 1-6 seats' USING ERRCODE = '23514'; END IF;
    IF EXISTS (SELECT 1 FROM "HoldSeat" hs JOIN "ShowSeat" s ON s.id=hs."showSeatId" JOIN "SeatHold" h ON h.id=hs."holdId" WHERE h.id=target AND s."showId" <> h."showId") THEN RAISE EXCEPTION 'Hold seat show mismatch' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER hold_items AFTER INSERT OR UPDATE ON "SeatHold" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_hold_items();
CREATE CONSTRAINT TRIGGER hold_item_count AFTER INSERT OR UPDATE OR DELETE ON "HoldSeat" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_hold_items();
CREATE TABLE session (sid varchar NOT NULL PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX session_expire_idx ON session (expire);
