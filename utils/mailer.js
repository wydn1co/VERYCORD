var nodemailer = require('nodemailer');
var config = require('../config');

var transporter = null;
if (config.smtp && config.smtp.host && config.smtp.user && config.smtp.pass) {
    transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
            user: config.smtp.user,
            pass: config.smtp.pass
        }
    });
}

async function sendBackupEmail(toEmail, backupData) {
    if (!transporter) return false;
    
    var mailOptions = {
        from: '"Verification System" <' + config.smtp.user + '>',
        to: toEmail,
        subject: 'Server Backup Created - ' + backupData.guildName,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #5865F2;">Your Server Backup is Ready!</h2>
                <p>A new backup has been successfully created for your Discord server: <strong>${backupData.guildName}</strong>.</p>
                <div style="background: #f6f6f7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Backup ID:</strong> <code style="font-size: 16px; background: #e3e5e8; padding: 4px 8px; border-radius: 4px;">${backupData.id}</code></p>
                </div>
                <p style="color: #5c5c6f; font-size: 14px;"><strong>Created At:</strong> ${new Date(backupData.createdAt).toLocaleString()}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 14px;">To restore your server layout and messages in the future, use the command:</p>
                <pre style="background: #2b2d31; color: #fff; padding: 10px; border-radius: 6px;">/backup load id:${backupData.id}</pre>
                <br>
                <p style="font-size: 12px; color: #8b8b9e;">This is an automated message from the VeryCord Verification System.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (e) {
        console.error('[mailer] Error sending email:', e.message);
        return false;
    }
}

module.exports = {
    sendBackupEmail
};
