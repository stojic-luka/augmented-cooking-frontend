import { z } from 'zod';

const otpVerificationSchema = z.object({
  email: z.email('Enter a valid email address'),
  token: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});

export type OtpVerificationFormValues = z.infer<typeof otpVerificationSchema>;
export default otpVerificationSchema;
