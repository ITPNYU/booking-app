import React, { useContext } from "react";

import { BookingContext } from "../bookingProvider";
import { DatabaseContext } from "../../components/Provider";
import FormInput from "../components/FormInput";
import { Inputs } from "../../../../types";
import Loading from "../../../utils/Loading";
import { useRouter } from "next/navigation";
import useSubmitBooking from "../hooks/useSubmitBooking";

export default function UserSectionPage() {
  const router = useRouter();
  const { userEmail, setUserEmail } = useContext(DatabaseContext);
  const { bookingCalendarInfo } = useContext(BookingContext);

  const [registerEvent, loading] = useSubmitBooking();

  const handleSubmit = async (data: Inputs) => {
    if (!bookingCalendarInfo) return;
    if (!userEmail && data.missingEmail) {
      setUserEmail(data.missingEmail);
    }
    registerEvent(data);
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="px-60">
      <button
        key="backToCalendar"
        disabled={!bookingCalendarInfo}
        onClick={() => {
          navigate("/book/selectRoom");
        }}
        className={`px-4 py-2 text-white rounded-md focus:outline-none ${
          bookingCalendarInfo
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-gray-300 pointer-events-none"
        }`}
      >
        Back to Calendar
      </button>
      <FormInput handleParentSubmit={handleSubmit} />
    </div>
  );
}
