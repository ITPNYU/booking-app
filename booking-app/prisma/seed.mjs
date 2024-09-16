import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rooms = [
    {
      roomId: 103,
      name: "The Garage",
      capacity: 74,
      calendarIdDev:
        "c_96d0951fc59bf720396cb997a62564ef6f1f9d45ec5db6cded4a4bb95bfae02b@group.calendar.google.com",
      calendarIdProd: "c_oea6k9fs8p6nvsai6f25uiue1c@group.calendar.google.com",
    },
    {
      roomId: 202,
      name: "Lecture Hall",
      capacity: 210,
      calendarIdDev:
        "c_cadf2be353a6162aab2c58b8b30ff75ea35b5f6c5163ed4fd57df71c00f03f6b@group.calendar.google.com",
      calendarIdProd:
        "nyu.edu_qii7e5htheep643hq8m5mu3ngg@group.calendar.google.com",
    },
    {
      roomId: 220,
      name: "Black Box",
      capacity: 30,
      calendarIdDev:
        "c_e8f6e893fa24c23f848d98b802902e92c52b665771542d8a89d2284456ad73f3@group.calendar.google.com",
      calendarIdProd: "c_dbn41lc126ghnl8f98gop59kfg@group.calendar.google.com",
    },
    {
      roomId: 221,
      name: "Ballroom A",
      capacity: 12,
      calendarIdDev:
        "c_9d58b3e286524a0b044af7b9a92da0b266e4105039650b0bd557bdcd76d5d1db@group.calendar.google.com",
      calendarIdProd:
        "nyu.edu_iif5nf5n543lav8tgka3td9u2s@group.calendar.google.com",
    },
    {
      roomId: 222,
      name: "Ballroom B",
      capacity: 12,
      calendarIdDev:
        "c_4dc286f20a5855fcbf80f9c6476547e4fce3841e4a7c855034ed9df074b857d0@group.calendar.google.com",
      calendarIdProd:
        "nyu.edu_0s1704spc5sqd5ra0epiks6r0o@group.calendar.google.com",
    },
    {
      roomId: 223,
      name: "Ballroom C",
      capacity: 12,
      calendarIdDev:
        "c_4f55a0dbe715b86b87fd4bae480d794895982b096cd2df0dd449de7b27d31e61@group.calendar.google.com",
      calendarIdProd:
        "nyu.edu_pkci0d2mp33rhpied80126cot4@group.calendar.google.com",
    },
    {
      roomId: 224,
      name: "Ballroom D",
      capacity: 12,
      calendarIdDev:
        "c_dc7ff82c6f3b5217883fc7c512b97618cd16ac2564047f8a2f7d87dd142b7c63@group.calendar.google.com",
      calendarIdProd:
        "nyu.edu_u29cf5805g3qviu36tucn76ihk@group.calendar.google.com",
    },
    {
      roomId: 230,
      name: "Audio Lab",
      capacity: 13,
      calendarIdDev:
        "c_83eebf9ac5f6cf46d583b777e6805e548949a27aa88ce56775681b6aa139a16f@group.calendar.google.com",
      calendarIdProd: "c_us27q4ttapcgdt9dc38lfsnn9s@group.calendar.google.com",
    },
    {
      roomId: 233,
      name: "Co-Lab",
      capacity: 50,
      calendarIdDev:
        "c_334de9eac5f1951dd22f53176d70b0752b192445eb5fcf0104f242d9383f90ee@group.calendar.google.com",
      calendarIdProd: "c_s93e1dmilqo8ol6cd9ugh64bl4@group.calendar.google.com",
    },
    {
      roomId: 260,
      name: "Post Production Lab",
      capacity: 20,
      calendarIdDev:
        "c_ed4919e8a07e1338ed3df9c7d7bceaece5a466b8d669a8a70d83b30a8627089e@group.calendar.google.com",
      calendarIdProd: "c_fdq6oqq965ge7k3gv6k2epsme0@group.calendar.google.com",
    },
    {
      roomId: 1201,
      name: "Seminar Room",
      capacity: 100,
      calendarIdDev:
        "c_f6f425226ac4db1d71237245f6b4cebc1631f59d55bae8a483465c47c24d3c48@group.calendar.google.com",
      calendarIdProd:
        "nyu.edu_aa15nlviffkp3tkt86ehe80n9o@group.calendar.google.com",
    },
  ];

  for (const room of rooms) {
    const createdRoom = await prisma.room.create({
      data: {
        roomId: room.roomId,
        name: room.name,
        capacity: room.capacity,
        calendarIdDev: room.calendarIdDev, // Assuming default values for missing properties
        calendarIdProd: room.calendarIdProd, // Assuming default values for missing properties
      },
    });
    console.log({ createdRoom });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
