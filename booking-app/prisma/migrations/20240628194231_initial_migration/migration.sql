-- CreateTable
CREATE TABLE `Room` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `roomId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `capacity` VARCHAR(191) NOT NULL,
    `calendarIdDev` VARCHAR(191) NOT NULL,
    `calendarIdProd` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Room_roomId_key`(`roomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Booking` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `roomId` INTEGER NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `secondaryName` VARCHAR(191) NOT NULL,
    `nNumber` VARCHAR(191) NOT NULL,
    `netId` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `sponsorFirstName` VARCHAR(191) NOT NULL,
    `sponsorLastName` VARCHAR(191) NOT NULL,
    `sponsorEmail` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `reservationType` VARCHAR(191) NOT NULL,
    `expectedAttendance` INTEGER NOT NULL,
    `attendeeAffiliation` VARCHAR(191) NOT NULL,
    `roomSetup` VARCHAR(191) NOT NULL,
    `setupDetails` VARCHAR(191) NOT NULL,
    `mediaServices` VARCHAR(191) NOT NULL,
    `mediaServicesDetails` VARCHAR(191) NOT NULL,
    `catering` VARCHAR(191) NOT NULL,
    `cateringService` VARCHAR(191) NOT NULL,
    `hireSecurity` VARCHAR(191) NOT NULL,
    `chartFieldForCatering` VARCHAR(191) NOT NULL,
    `chartFieldForSecurity` VARCHAR(191) NOT NULL,
    `chartFieldForRoomSetup` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL,
    `firstApprovedAt` DATETIME(3) NOT NULL,
    `secondApprovedAt` DATETIME(3) NOT NULL,
    `rejectedAt` DATETIME(3) NOT NULL,
    `canceledAt` DATETIME(3) NOT NULL,
    `checkedInAt` DATETIME(3) NOT NULL,
    `noShowedAt` DATETIME(3) NOT NULL,
    `finalApprovedAt` DATETIME(3) NOT NULL,
    `bookingId` INTEGER NOT NULL,

    UNIQUE INDEX `BookingStatus_bookingId_key`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUser` (
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUser_email_key`(`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaUser` (
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaUser_email_key`(`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SafetyTrainingUser` (
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SafetyTrainingUser_email_key`(`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BannedUser` (
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BannedUser_email_key`(`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Liaison` (
    `email` VARCHAR(191) NOT NULL,
    `departmentId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Liaison_email_key`(`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reservationType` (
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reservationType_name_key`(`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BookingStatus` ADD CONSTRAINT `BookingStatus_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Liaison` ADD CONSTRAINT `Liaison_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
