export {
  type BookingMail,
  bookingAwaitingPaymentEmail,
  bookingCancelledEmail,
  bookingConfirmedEmail,
  bookingPaymentReceivedEmail,
  bookingPendingEmail,
  bookingPromotedEmail,
  bookingRefundedEmail,
  bookingRefusedEmail,
  bookingReminderEmail,
  bookingRescheduledEmail,
  bookingWaitlistedEmail,
  teamAlmostFullEmail,
  teamBookingEmail,
  teamReminderEmail,
  weeklyDigestEmail,
} from "./booking-templates";
export { escapeHtml } from "./layout";
export { createConsoleMailer, createSmtpMailer, type EmailContent, type Mailer } from "./mailer";
export {
  customerLoginEmail,
  emailVerificationEmail,
  invitationEmail,
  passwordResetEmail,
} from "./templates";
