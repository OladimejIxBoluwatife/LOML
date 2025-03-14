// server.js
const express = require('express');
const { google } = require('googleapis');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const apikeys = require('./apikeys.json');

const app = express();
const port = 3000;

// Google Drive API scope
const SCOPE = ['https://www.googleapis.com/auth/drive'];

// Configure Multer for file uploads
const upload = multer({
  dest: 'uploads/', // Temporary directory to store uploaded files
});

// Authorize with Google Drive API
async function authorize() {
  const jwtClient = new google.auth.JWT(
    apikeys.client_email,
    null,
    apikeys.private_key,
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