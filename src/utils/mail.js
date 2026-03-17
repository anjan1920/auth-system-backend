import Mailgen from "mailgen";
import axios from "axios";

// send email using Brevo API
const sendEmail = async (options) => {
  const mailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "Authentication & Authorization",
      link: "****",
    },
  });

  const emailTextual = mailGenerator.generatePlaintext(
    options.mailgenContent
  );
  const emailHtml = mailGenerator.generate(options.mailgenContent);

  const mailPayload = {
    sender: {
      name: "Authentication System",
      email: process.env.BREVO_USER,
    },
    to: [{ email: options.email }],
    subject: options.subject,
    htmlContent: emailHtml,
    textContent: emailTextual,
  };

  try {
    console.log("Sending email via Brevo API..");

    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      mailPayload,
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Email sent successfully:", response.data);

    return response.data;
  } catch (error) {
    console.error(
      "Email sending failed:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// email verification template
const emailVerificationMailgenContent = (username, verificationUrl) => {
  return {
    body: {
      name: username,
      intro: "Welcome to our App! We're excited to have you on board.",
      action: {
        instructions:
          "To verify your email please click on the following button:",
        button: {
          color: "#22BC66",
          text: "Verify your email",
          link: verificationUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

// forgot password template
const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
  return {
    body: {
      name: username,
      intro: "We received a request to reset your account password.",
      action: {
        instructions:
          "Click the button below to reset your password:",
        button: {
          color: "#22BC66",
          text: "Reset Password",
          link: passwordResetUrl,
        },
      },
      outro:
        "If you didn't request a password reset, you can safely ignore this email.",
    },
  };
};

export {
  sendEmail,
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
};