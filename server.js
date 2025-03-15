const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; // Use Render's port or default to 3000 locally

// Google Drive API scope
const SCOPE = ['https://www.googleapis.com/auth/drive'];

// Configure Multer for file uploads
const upload = multer({
  dest: 'uploads/', // Temporary directory to store uploaded files
});

// Authorize with Google Drive API
async function authorize() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google Cloud credentials (GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY) must be set in environment variables.');
  }

  const jwtClient = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    SCOPE
  );

  await jwtClient.authorize();
  return jwtClient;
}

// Upload file to Google Drive
async function uploadFile(authClient, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const drive = google.drive({ version: 'v3', auth: authClient });

    const fileMetaData = {
      name: fileName,
      parents: ['1PmgmVBCrN_g-Pw3Ydj-Ia3D3acllv3wV'], // Your Google Drive folder ID
    };

    drive.files.create({
      resource: fileMetaData,
      media: {
        body: fs.createReadStream(filePath),
        mimeType: 'application/octet-stream', // Generic mime type for various file types
      },
      fields: 'id',
    }, (error, file) => {
      if (error) {
        return reject(error);
      }
      resolve(file);
    });
  });
}

// Serve static files (your website)
app.use(express.static(path.join(__dirname, 'public')));

// Handle file upload route
app.post('/upload', upload.array('myFile'), async (req, res) => {
  try {
    const authClient = await authorize();
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    // Upload each file to Google Drive
    const uploadPromises = files.map(file => {
      return uploadFile(authClient, file.path, file.originalname)
        .then(() => {
          // Delete the temporary file after upload
          fs.unlinkSync(file.path);
        });
    });

    await Promise.all(uploadPromises);
    res.json({ success: true, message: `${files.length} file(s) uploaded successfully!` });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});