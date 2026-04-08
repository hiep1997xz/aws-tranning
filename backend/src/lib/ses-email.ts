import { SendEmailCommand } from '@aws-sdk/client-ses';
import { sesClient } from '../config/ses.js';
import { env } from '../config/env.js';

export const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
  const command = new SendEmailCommand({
    Source: env.SES_FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: 'Welcome to CRUD Admin!', Charset: 'UTF-8' },
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: `
            <h2>Hi ${name},</h2>
            <p>Your account has been created successfully.</p>
            <p>You can now log in at <a href="${env.FRONTEND_URL}">${env.FRONTEND_URL}</a>.</p>
          `.trim(),
        },
        Text: {
          Charset: 'UTF-8',
          Data: `Hi ${name},\n\nYour account has been created successfully.\n\nLogin at: ${env.FRONTEND_URL}`,
        },
      },
    },
  });

  await sesClient.send(command);
};
