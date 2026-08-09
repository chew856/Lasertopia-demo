-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "updatedByUserId" TEXT,
    CONSTRAINT "Setting_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "ManagerUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "RoomConfiguration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "roomSlotsConsumed" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "RoomConfigurationRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomConfigurationId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RoomConfigurationRoom_roomConfigurationId_fkey" FOREIGN KEY ("roomConfigurationId") REFERENCES "RoomConfiguration" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoomConfigurationRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartyWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxParties" INTEGER
);

-- CreateTable
CREATE TABLE "WindowOffering" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyWindowId" TEXT NOT NULL,
    "roomConfigurationId" TEXT NOT NULL,
    "isOffered" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WindowOffering_partyWindowId_fkey" FOREIGN KEY ("partyWindowId") REFERENCES "PartyWindow" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WindowOffering_roomConfigurationId_fkey" FOREIGN KEY ("roomConfigurationId") REFERENCES "RoomConfiguration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartyGameSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyWindowId" TEXT NOT NULL,
    "setIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PartyGameSet_partyWindowId_fkey" FOREIGN KEY ("partyWindowId") REFERENCES "PartyWindow" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartyGameSetTime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyGameSetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'BRIEF',
    CONSTRAINT "PartyGameSetTime_partyGameSetId_fkey" FOREIGN KEY ("partyGameSetId") REFERENCES "PartyGameSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperatingHours" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL,
    "opensMinutes" INTEGER NOT NULL,
    "closesMinutes" INTEGER NOT NULL,
    "firstPublicGameMinutes" INTEGER NOT NULL,
    "lastPublicGameMinutes" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "PartyOnlyGameTime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Closure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "blocksParties" BOOLEAN NOT NULL DEFAULT true,
    "blocksPublic" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "extraGuestPriceCents" INTEGER NOT NULL,
    "baseGuests" INTEGER NOT NULL,
    "gamesIncluded" INTEGER NOT NULL,
    "roomMinutes" INTEGER NOT NULL,
    "includesPizza" BOOLEAN NOT NULL,
    "includesCupcakes" BOOLEAN NOT NULL,
    "includesHotDogOption" BOOLEAN NOT NULL,
    "funCardCentsPerGuest" INTEGER NOT NULL DEFAULT 0,
    "includesLazerFrenzy" BOOLEAN NOT NULL DEFAULT false,
    "includesTyphoon" BOOLEAN NOT NULL DEFAULT false,
    "arcadeCardEligible" BOOLEAN NOT NULL DEFAULT true,
    "descriptionMarkdown" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "PizzaTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "minGuests" INTEGER NOT NULL,
    "maxGuests" INTEGER NOT NULL,
    "pizzaCount" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "taxIncluded" BOOLEAN NOT NULL,
    "requiresOptionChoice" BOOLEAN NOT NULL DEFAULT false,
    "exclusiveGroup" TEXT,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "AddOnPackageEligibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "addOnId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    CONSTRAINT "AddOnPackageEligibility_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AddOnPackageEligibility_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AddOnOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "addOnId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AddOnOption_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameSlotPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameCount" INTEGER NOT NULL,
    "pricePerPersonCents" INTEGER NOT NULL,
    "taxIncluded" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "GameSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "startsAtUtc" DATETIME NOT NULL,
    "mode" TEXT NOT NULL,
    "sourcePartyGameSetId" TEXT,
    "releasedToPublicAt" DATETIME,
    "blockedReason" TEXT,
    CONSTRAINT "GameSlot_sourcePartyGameSetId_fkey" FOREIGN KEY ("sourcePartyGameSetId") REFERENCES "PartyGameSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "notes" TEXT,
    "createdVia" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "holdExpiresAt" DATETIME,
    "preTaxSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "taxIncludedTotalCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "taxRateMilliPercentSnapshot" INTEGER NOT NULL DEFAULT 0,
    "acknowledgedShoePolicy" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedFoodPolicy" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "ManagerUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicGameBooking" (
    "bookingId" TEXT NOT NULL PRIMARY KEY,
    "playerCount" INTEGER NOT NULL,
    "gameCount" INTEGER NOT NULL,
    "pricePerPersonCentsSnapshot" INTEGER NOT NULL,
    CONSTRAINT "PublicGameBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PartyBooking" (
    "bookingId" TEXT NOT NULL PRIMARY KEY,
    "partyWindowId" TEXT NOT NULL,
    "roomConfigurationId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "honoreeName" TEXT NOT NULL,
    "honoreeAge" INTEGER NOT NULL,
    "foodChoice" TEXT NOT NULL DEFAULT 'NONE',
    "includedPizzaCount" INTEGER NOT NULL DEFAULT 0,
    "packagePriceCentsSnapshot" INTEGER NOT NULL,
    "extraGuestPriceCentsSnapshot" INTEGER NOT NULL,
    "windowStartsAtUtc" DATETIME NOT NULL,
    "windowEndsAtUtc" DATETIME NOT NULL,
    CONSTRAINT "PartyBooking_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartyBooking_partyWindowId_fkey" FOREIGN KEY ("partyWindowId") REFERENCES "PartyWindow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PartyBooking_roomConfigurationId_fkey" FOREIGN KEY ("roomConfigurationId") REFERENCES "RoomConfiguration" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PartyBooking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingRoomSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startsAtUtc" DATETIME NOT NULL,
    "endsAtUtc" DATETIME NOT NULL,
    CONSTRAINT "BookingRoomSlot_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingRoomSlot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "gameSlotId" TEXT NOT NULL,
    "arenaGroupIndex" INTEGER NOT NULL DEFAULT 0,
    "playerCount" INTEGER NOT NULL,
    "partyGameSetId" TEXT,
    "assignmentSource" TEXT NOT NULL,
    CONSTRAINT "BookingGame_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingGame_gameSlotId_fkey" FOREIGN KEY ("gameSlotId") REFERENCES "GameSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookingGame_partyGameSetId_fkey" FOREIGN KEY ("partyGameSetId") REFERENCES "PartyGameSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingAddOn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "addOnOptionId" TEXT,
    "unitPriceCentsSnapshot" INTEGER NOT NULL,
    "taxIncludedSnapshot" BOOLEAN NOT NULL,
    "lineTotalCents" INTEGER NOT NULL,
    CONSTRAINT "BookingAddOn_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookingAddOn_addOnOptionId_fkey" FOREIGN KEY ("addOnOptionId") REFERENCES "AddOnOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "simulatedReference" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "Deposit_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "issuedFromBookingId" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" DATETIME,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GiftCard_issuedFromBookingId_fkey" FOREIGN KEY ("issuedFromBookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingChangeLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingChangeLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "ManagerUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManagerUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomConfiguration_code_key" ON "RoomConfiguration"("code");

-- CreateIndex
CREATE INDEX "RoomConfigurationRoom_roomId_idx" ON "RoomConfigurationRoom"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomConfigurationRoom_roomConfigurationId_roomId_key" ON "RoomConfigurationRoom"("roomConfigurationId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyWindow_dayOfWeek_startMinutes_key" ON "PartyWindow"("dayOfWeek", "startMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "WindowOffering_partyWindowId_roomConfigurationId_key" ON "WindowOffering"("partyWindowId", "roomConfigurationId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyGameSet_partyWindowId_setIndex_key" ON "PartyGameSet"("partyWindowId", "setIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PartyGameSetTime_partyGameSetId_startMinutes_key" ON "PartyGameSetTime"("partyGameSetId", "startMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingHours_dayOfWeek_key" ON "OperatingHours"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "PartyOnlyGameTime_dayOfWeek_startMinutes_key" ON "PartyOnlyGameTime"("dayOfWeek", "startMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "Closure_date_key" ON "Closure"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Package_code_key" ON "Package"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PizzaTier_minGuests_key" ON "PizzaTier"("minGuests");

-- CreateIndex
CREATE UNIQUE INDEX "AddOn_code_key" ON "AddOn"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AddOnPackageEligibility_addOnId_packageId_key" ON "AddOnPackageEligibility"("addOnId", "packageId");

-- CreateIndex
CREATE UNIQUE INDEX "AddOnOption_addOnId_label_key" ON "AddOnOption"("addOnId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "GameSlotPricing_gameCount_key" ON "GameSlotPricing"("gameCount");

-- CreateIndex
CREATE INDEX "GameSlot_date_mode_idx" ON "GameSlot"("date", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "GameSlot_date_startMinutes_key" ON "GameSlot"("date", "startMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE INDEX "Booking_date_status_idx" ON "Booking"("date", "status");

-- CreateIndex
CREATE INDEX "PartyBooking_partyWindowId_idx" ON "PartyBooking"("partyWindowId");

-- CreateIndex
CREATE INDEX "BookingRoomSlot_roomId_date_idx" ON "BookingRoomSlot"("roomId", "date");

-- CreateIndex
CREATE INDEX "BookingRoomSlot_bookingId_idx" ON "BookingRoomSlot"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRoomSlot_roomId_startsAtUtc_key" ON "BookingRoomSlot"("roomId", "startsAtUtc");

-- CreateIndex
CREATE INDEX "BookingGame_gameSlotId_idx" ON "BookingGame"("gameSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingGame_bookingId_gameSlotId_key" ON "BookingGame"("bookingId", "gameSlotId");

-- CreateIndex
CREATE INDEX "BookingAddOn_bookingId_idx" ON "BookingAddOn"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_bookingId_key" ON "Deposit"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_code_key" ON "GiftCard"("code");

-- CreateIndex
CREATE INDEX "BookingChangeLog_bookingId_createdAt_idx" ON "BookingChangeLog"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerUser_email_key" ON "ManagerUser"("email");
