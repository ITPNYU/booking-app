import React, { useContext, useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { BookingContext } from '../bookingProvider';
import { DatabaseContext } from '../../components/Provider';
import { Inputs } from '../../../../types';
import PropTypes from 'prop-types';

const ErrorMessage = (message) => {
  return (
    <p className="mt-2 w-4/5 text-xs text-red-600 dark:text-red-500">
      {message.errors && message.errors !== ''
        ? message.errors
        : 'This field is required'}
    </p>
  );
};

const FormInput = ({ handleParentSubmit }) => {
  const { userEmail } = useContext(DatabaseContext);
  const { role, department, selectedRooms } = useContext(BookingContext);
  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<Inputs>({
    defaultValues: {
      setupDetails: '',
      cateringService: '',
      sponsorFirstName: '',
      sponsorLastName: '',
      sponsorEmail: '',
      mediaServicesDetails: '',
      role,
      catering: '',
      chartFieldForCatering: '',
      chartFieldForSecurity: '',
      chartFieldForRoomSetup: '',
      hireSecurity: '',
      attendeeAffiliation: '',
      department,
      roomSetup: '',
    },
    mode: 'onBlur',
  });
  const [checklist, setChecklist] = useState(false);
  const [resetRoom, setResetRoom] = useState(false);
  const [bookingPolicy, setBookingPolicy] = useState(false);
  const [showTextbox, setShowTextbox] = useState(false);
  const roomNumber = selectedRooms.map((room) => room.roomId);

  const maxCapacity = selectedRooms.reduce((sum, room) => {
    return sum + parseInt(room.capacity);
  }, 0);

  const validateExpectedAttendance = (value) => {
    const attendance = parseInt(value);
    return (
      (!isNaN(attendance) && attendance <= maxCapacity) ||
      `Expected attendance exceeds maximum capacity of ${maxCapacity}`
    );
  };

  const validateSponsorEmail = (value: string) => {
    if (value === userEmail) {
      return 'Sponsor email cannot be your own email';
    }
    return true;
  };

  const disabledButton = !(checklist && resetRoom && bookingPolicy);
  useEffect(() => {
    trigger();
  }, [trigger]);

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    const dumpMediaServices = data.mediaServices || [];
    data.mediaServices = Array.isArray(dumpMediaServices)
      ? dumpMediaServices.join(', ')
      : dumpMediaServices;
    handleParentSubmit(data);
  };

  const handleSelectChange = (event) => {
    if (event.target.value === 'others') {
      setShowTextbox(true);
    } else {
      setShowTextbox(false);
    }
  };

  return (
    <form className="py-10 items-center" onSubmit={handleSubmit(onSubmit)}>
      {userEmail == null && (
        <div className="mb-6">
          <label
            htmlFor="missingEmail"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Email
          </label>
          <p className="text-xs">
            This section is displayed only to those who couldn't obtain an email
          </p>

          {errors.missingEmail && (
            <ErrorMessage errors={errors.missingEmail.message} />
          )}
          <input
            type="text"
            id="missingEmail"
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder=""
            {...register('missingEmail')}
          />
        </div>
      )}
      <div className="mb-6">
        <label
          htmlFor="firstName"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          First Name
        </label>
        {errors.firstName && <ErrorMessage errors={errors.firstName.message} />}
        <input
          type="firstName"
          id="firstName"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder=""
          {...register('firstName', { required: true })}
        />
      </div>
      <div className="mb-6">
        <label
          htmlFor="lastName"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Last Name
        </label>
        {errors.lastName && <ErrorMessage errors={errors.lastName.message} />}
        <input
          type="lastName"
          id="lastName"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder=""
          {...register('lastName', { required: true })}
        />
      </div>
      <div className="mb-6">
        <label
          htmlFor="secondaryName"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Secondary Point of Contact
        </label>
        <p className="text-xs">
          If the person submitting this request is not the Point of Contact for
          the reservation, please add their name and contact information here
          (Ie Event organizer, faculty member, etc)
        </p>
        {errors.secondaryName && (
          <ErrorMessage errors={errors.secondaryName.message} />
        )}
        <input
          type="secondaryName"
          id="secondaryName"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder=""
          {...register('secondaryName')}
        />
      </div>
      <div className="mb-6">
        <label
          htmlFor="nNumber"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          NYU N-number
        </label>
        <p className="text-xs">
          Your N-number begins with a capital 'N' followed by eight digits.
        </p>
        {errors.nNumber && <ErrorMessage errors={errors.nNumber.message} />}
        <input
          type="nNumber"
          id="nNumber"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder=""
          {...register('nNumber', {
            required: true,
            pattern: {
              value: /N[0-9]{8}/,
              message:
                "Your N-number begins with a capital 'N' followed by eight digits.",
            },
          })}
        />
      </div>
      <div className="mb-6">
        <label
          htmlFor="netId"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          NYU Net ID
        </label>
        <p className="text-xs">
          Your Net ID is the username portion of your official NYU email
          address. It begins with your initials followed by one or more numbers.
        </p>
        {errors.netId && <ErrorMessage errors={errors.netId.message} />}
        <input
          type="netId"
          id="netId"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder=""
          {...register('netId', {
            required: true,
            pattern: {
              value: /[a-zA-Z]{1,3}[0-9]{1,6}/,
              message: 'Invalid Net ID',
            },
          })}
        />
      </div>
      <div className="mb-6">
        <label
          htmlFor="phoneNumber"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Phone Number
        </label>
        {errors.phoneNumber && (
          <ErrorMessage errors={errors.phoneNumber.message} />
        )}
        <input
          type="phoneNumber"
          id="phoneNumber"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder=""
          {...register('phoneNumber', {
            required: true,
            pattern: {
              value:
                /^\(?([2-9][0-8][0-9])\)?[-. ]?([2-9][0-9]{2})[-. ]?([0-9]{4})$/,
              message: 'Please enter a valid 10 digit telephone number.',
            },
          })}
        />
      </div>

      {watch('role') === 'Student' && (
        <div>
          <div className="mb-6">
            <label
              htmlFor="sponsorFirstName"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Sponsor First Name
            </label>
            {errors.sponsorFirstName && (
              <ErrorMessage errors={errors.sponsorFirstName.message} />
            )}
            <input
              type="sponsorFirstName"
              id="sponsorFirstName"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder=""
              {...register('sponsorFirstName', {
                required: watch('role') === 'Student',
              })}
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="sponsorLastName"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Sponsor Last Name
            </label>
            {errors.sponsorFirstName && (
              <ErrorMessage errors={errors.sponsorFirstName.message} />
            )}
            <input
              type="sponsorLastName"
              id="sponsorLastName"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder=""
              {...register('sponsorLastName', {
                required: watch('role') === 'Student',
              })}
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="sponsorEmail"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              Sponsor Email
            </label>
            <p className="text-xs">Must be an nyu.edu email address</p>
            {errors.sponsorEmail && (
              <ErrorMessage errors={errors.sponsorEmail.message} />
            )}
            <input
              type="sponsorEmail"
              id="sponsorEmail"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder=""
              {...register('sponsorEmail', {
                pattern: {
                  value: /^[A-Z0-9._%+-]+@nyu.edu$/i,
                  message: 'Invalid email address',
                },
                required: watch('role') === 'Student',
                validate: validateSponsorEmail,
              })}
            />
          </div>
        </div>
      )}
      <div className="mb-6">
        <label
          htmlFor="title"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Reservation Title
        </label>
        {errors.title && <ErrorMessage errors={errors.title.message} />}
        <input
          type="title"
          id="title"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder=""
          {...register('title', { required: true })}
        />
      </div>
      <div className="mb-6">
        <label
          htmlFor="description"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Reservation Description
        </label>
        {errors.description && (
          <ErrorMessage errors={errors.description.message} />
        )}
        <input
          type="description"
          id="description"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          placeholder=""
          {...register('description', { required: true })}
        />
      </div>
      <div className="mb-6">
        <label
          htmlFor="expectedAttendance"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Expected Attendance
        </label>
        <p className="text-xs"></p>
        {errors.expectedAttendance && (
          <ErrorMessage errors={errors.expectedAttendance.message} />
        )}
        <input
          id="expectedAttendance"
          type="number"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          {...register('expectedAttendance', {
            required: true,
            validate: validateExpectedAttendance,
          })}
        />
      </div>
      <div className="mb-6">
        <label
          htmlFor="attendeeAffiliation"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Attendee Affiliation(s)
        </label>
        <p className="text-xs">
          Non-NYU guests will need to be sponsored through JRNY. For more
          information about visitor, vendor, and affiliate access,
          <a
            href="https://www.nyu.edu/about/visitor-information/sponsoring-visitors.html"
            className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
            target="_blank"
          >
            click here
          </a>
          .
        </p>
        {errors.attendeeAffiliation && (
          <ErrorMessage errors={errors.attendeeAffiliation.message} />
        )}
        <div className="flex items-center mb-4">
          <select
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            {...register('attendeeAffiliation', {
              required: true,
              validate: (value) => value !== '',
            })}
          >
            <option value="" disabled>
              Select option
            </option>
            <option value="NYU Members">
              NYU Members with an Active NYU ID
            </option>
            <option value="Non-NYU Guests">Non-NYU Guests</option>
            <option value="All of the above"> All of the above</option>
          </select>
        </div>
      </div>
      <div className="mb-6">
        <label
          htmlFor="roomSetup"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Room setup needed?
        </label>
        <p className="text-xs">
          If your reservation is in 233 or 1201 and requires a specific room
          setup that is different from the standard configuration, it is the
          reservation holder’s responsibility to submit a
          <a
            className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
            href="https://nyu.service-now.com/csmp?id=sc_home"
            target="_blank"
          >
            work order with CBS
          </a>
          . <br />
          It is also the reservation holder's responsibility to ensure the room
          is reset after use.
          <br />
        </p>
        {errors.roomSetup && <ErrorMessage errors={errors.roomSetup.message} />}
        <div className="flex items-center mb-4">
          <select
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            {...register('roomSetup', {
              required: true,
              validate: (value) => value !== '',
            })}
          >
            <option value="" disabled>
              Select option
            </option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
      {watch('roomSetup') === 'yes' && (
        <div className="mb-6">
          <label
            htmlFor="setupDetails"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            If you chose "Yes" to Room Setup and are not using 233 or 1201,
            please explain your needs including # of chairs, # tables, and
            formation.
          </label>
          <p className="text-xs"></p>
          {errors.setupDetails && (
            <ErrorMessage errors={errors.setupDetails.message} />
          )}
          <input
            type="textarea"
            id="setupDetails"
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            placeholder=""
            {...register('setupDetails', {
              required: watch('roomSetup') === 'yes',
              validate: (value) => value !== '',
            })}
          />
        </div>
      )}
      {watch('roomSetup') === 'yes' && (
        <div className="mb-6">
          <label
            htmlFor="chartFieldForRoomSetup"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            ChartField for Room Setup
          </label>
          {errors.chartFieldForRoomSetup && (
            <ErrorMessage errors={errors.chartFieldForRoomSetup.message} />
          )}
          <div className="flex items-center mb-4">
            <input
              type="text"
              id="chartFieldForRoomSetup"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder=""
              {...register('chartFieldForRoomSetup', {
                required: watch('roomSetup') === 'yes',
              })}
            />
          </div>
        </div>
      )}
      <div className="mb-6">
        <label
          htmlFor="mediaServices"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Media Services
        </label>
        <p className="text-xs"></p>
        {errors.mediaServices && (
          <ErrorMessage errors={errors.mediaServices.message} />
        )}
        <div className="flex flex-col mb-4">
          {roomNumber.some((room) =>
            [103, 220, 221, 222, 223, 224, 230, 233, 260].includes(Number(room))
          ) && (
            <label key={'checkoutEquipment'}>
              <input
                type="checkbox"
                value="Checkout equipment"
                {...register('mediaServices')}
              />
              Checkout equipment
            </label>
          )}
          {roomNumber.includes('103') && (
            <label key={'103audioTechnician'}>
              <input
                type="checkbox"
                value="(For Garage 103) Request an audio technician"
                {...register('mediaServices')}
              />
              (For Garage 103) Request an audio technician
            </label>
          )}
          {roomNumber.includes('103') && (
            <label key={'103lightingTechnician'}>
              <input
                type="checkbox"
                value="(For Garage 103) Request a lighting technician"
                {...register('mediaServices')}
              />
              (For Garage 103) Request a lighting technician
            </label>
          )}
          {roomNumber.includes('230') && (
            <label key={'230lightingTechnician'}>
              <input
                type="checkbox"
                value="(For Audio Lab 230) Request an audio technician"
                {...register('mediaServices')}
              />
              (For Audio Lab 230) Request an audio technician
            </label>
          )}
          {roomNumber.some((room) =>
            [220, 221, 222, 223, 224].includes(Number(room))
          ) && (
            <label key={'103audioTechnician'}>
              <input
                type="checkbox"
                value="(For Garage 103) Request an audio technician"
                {...register('mediaServices')}
              />
              (For 220-224) Using DMX lights in ceiling grid
            </label>
          )}
          {roomNumber.some((room) => [202, 1201].includes(Number(room))) && (
            <label key={'support'}>
              <input
                type="checkbox"
                value="(For 202 and 1201) Contact Campus Media for technical and event support"
                {...register('mediaServices')}
              />
              (For 202 and 1201) Contact Campus Media if you need to check out
              equipment or need technical and/or event support.
            </label>
          )}
        </div>
      </div>
      {watch('mediaServices') !== undefined &&
        watch('mediaServices').length > 0 && (
          <div className="mb-6">
            <label
              htmlFor="mediaServicesDetails"
              className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
            >
              If you selected any of the Media Services above, please describe
              your needs in detail. If you need to check out equipment, you can
              check our inventory and include your request below. (Ie. 2x Small
              Mocap Suits)
              <br />-{' '}
              <a
                href="https://docs.google.com/document/d/1oRtvZ0SR52Mq_ykoNXelwqat4JFgdado5JDY6A746VY/edit#heading=h.iv9c7z15bn0t"
                target="_blank"
                className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
              >
                Inventory for Black Box 220 and Ballrooms 221-224
              </a>
              <br />-{' '}
              <a
                href="https://docs.google.com/spreadsheets/d/1fziyVrzeytQJyZ8585Wtqxer-PBt6L-u-Z0LHVavK5k/edit#gid=870626522"
                target="_blank"
                className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
              >
                Inventory for Garage 103
              </a>
              <br />
            </label>
            <p className="text-xs"></p>
            {errors.mediaServicesDetails && (
              <ErrorMessage errors={errors.mediaServicesDetails.message} />
            )}
            <input
              type="text"
              id="mediaServicesDetails"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder=""
              {...register('mediaServicesDetails', {
                required: watch('mediaServices').length > 0,
              })}
            />
          </div>
        )}
      <div className="mb-6">
        <label
          htmlFor="catering"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Catering
        </label>
        {errors.catering && <ErrorMessage errors={errors.catering.message} />}
        <div className="flex items-center mb-4">
          <select
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            {...register('catering', {
              required: true,
              validate: (value) => value !== '',
            })}
          >
            <option value="" disabled>
              Select option
            </option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
      {watch('catering') === 'yes' && (
        <div className="mb-6">
          <label
            htmlFor="cateringService"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            Catering Information
          </label>
          <p className="text-xs">
            It is required for the reservation holder to pay and arrange for CBS
            cleaning services if the event includes catering.
          </p>
          <div className="flex items-center mb-4">
            <select
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              {...register('cateringService')}
            >
              <option value="" disabled>
                Select option
              </option>
              <option value="Outside Catering">Outside Catering</option>
              <option selected value="NYU Plated">
                NYU Plated
              </option>
            </select>
          </div>
        </div>
      )}
      {watch('catering') === 'yes' && (
        <div className="mb-6">
          <label
            htmlFor="chartFieldForCatering"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            ChartField for Catering
          </label>
          <div className="flex items-center mb-4">
            <input
              type="text"
              id="chartFieldForCatering"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder=""
              {...register('chartFieldForCatering')}
            />
          </div>
        </div>
      )}

      <div className="mb-6">
        <label
          htmlFor="hireSecurity"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          Hire Security
        </label>
        <p className="text-xs">
          Only for large events with 75+ attendees, and bookings in The Garage
          where the Willoughby entrance will be in use. Once your booking is
          confirmed, it is your responsibility to hire Campus Safety for your
          event. If appropriate, please coordinate with your departmental
          Scheduling Liaison to hire Campus Safety, as there is a fee.
          <a
            href="https://www.nyu.edu/life/safety-health-wellness/campus-safety.html"
            target="_blank"
            className="text-blue-600 hover:underline dark:text-blue-500 mx-1"
          >
            Click for Campus Safety Form
          </a>
        </p>
        {errors.hireSecurity && (
          <ErrorMessage errors={errors.hireSecurity.message} />
        )}
        <div className="flex items-center mb-4">
          <select
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            {...register('hireSecurity', { required: true })}
          >
            <option value="">Select option</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
      {watch('hireSecurity') === 'yes' && (
        <div className="mb-6">
          <label
            htmlFor="chartFieldForSecurity"
            className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
          >
            ChartField for Security
          </label>
          <div className="flex items-center mb-4">
            <input
              type="text"
              id="chartFieldForSecurity"
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-[600px] p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              placeholder=""
              {...register('chartFieldForSecurity')}
            />
          </div>
        </div>
      )}

      <div className="mb-6">
        <label
          htmlFor="checklist"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          I confirm receipt of the
          <a
            href="https://docs.google.com/document/d/1TIOl8f8-7o2BdjHxHYIYELSb4oc8QZMj1aSfaENWjR8/edit?usp=sharing"
            target="_blank"
            className="text-blue-600 hover:underline dark:text-blue-500 mx-1 mx-1"
          >
            370J Pre-Event Checklist
          </a>
          and acknowledge that it is my responsibility to setup various event
          services as detailed within the checklist. While the 370J Operations
          staff do setup cleaning services through CBS, they do not facilitate
          hiring security, catering, and arranging room setup services.
        </label>
        <div className="flex items-center mb-4">
          <input
            id="checklist"
            type="checkbox"
            value=""
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            onChange={() => setChecklist(!checklist)}
          />
          <label
            htmlFor="checklist"
            className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
          >
            I agree
          </label>
        </div>
      </div>
      <div className="mb-6">
        <label
          htmlFor="resetRoom"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          I agree to reset any and all requested rooms and common spaces to
          their original state at the end of the event, including cleaning and
          furniture return, and will notify building staff of any problems,
          damage, or other concerns affecting the condition and maintenance of
          the reserved space. I understand that if I do not reset the room, I
          will lose reservation privileges.
        </label>
        <div className="flex items-center mb-4">
          <input
            id="resetRoom"
            type="checkbox"
            value=""
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            onChange={() => setResetRoom(!resetRoom)}
          />
          <label
            htmlFor="resetRoom"
            className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
          >
            I agree
          </label>
        </div>
      </div>

      <div className="mb-6">
        <label
          htmlFor="bookingPolicy"
          className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
        >
          I have read the
          <a
            href="https://docs.google.com/document/d/1vAajz6XRV0EUXaMrLivP_yDq_LyY43BvxOqlH-oNacc/edit?usp=sharing"
            target="_blank"
            className="text-blue-600 hover:underline dark:text-blue-500 mx-1 mx-1"
          >
            Booking Policy for 370 Jay Street Shared Spaces
          </a>
          and agree to follow all policies outlined. I understand that I may
          lose access to spaces if I break this agreement.
        </label>
        <div className="flex items-center mb-4">
          <input
            id="bookingPolicy"
            type="checkbox"
            value=""
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            onChange={() => setBookingPolicy(!bookingPolicy)}
          />
          <label
            htmlFor="bookingPolicy"
            className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300"
          >
            I agree
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={disabledButton}
        className={`${
          disabledButton && 'cursor-not-allowed'
        } text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800`}
      >
        Submit
      </button>
    </form>
  );
};

export default FormInput;

FormInput.propTypes = {
  submitNewSheet: PropTypes.func,
};
