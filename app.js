const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
app.use(cors());

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Initialize Google Drive API
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI,
);

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client,
});

app.get('/api/files', async (req, res) => {
  try {
    const result = await drive.files.list();
    res.json(result.data);
  } catch (error) {
    console.error(error)
    res.status(500);
  }
});

app.get('/api/permissions', async (req, res) => {
  try {
    const result = await drive.permissions.list({
      fileId: req.query.fileId,
      fields: 'permissions(id,role,type,emailAddress)',
    });
    res.json(result.data);
  } catch (error) {
    console.error(error)
    res.status(500);
  }
});

app.get('/api/download', async (req, res) => {
  // We need to export the file, download, then stream to client
  const fileId = req.query.fileId;
  const mimeType = 'application/pdf'; // default to PDF which should work for most files

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  drive.files.export({ fileId: fileId, mimeType: mimeType }, { responseType: 'stream' }, function (err, response) {
    if (err) {
      console.error('Error exporting the file:', err);
      res.status(500);
      return;
    }

    response.data
      .on('end', () => {
        console.log('Done downloading file.');
      })
      .on('error', err => {
        console.error('Error downloading file.', err);
        res.status(500);
      })
      .pipe(res);
  });
});

app.get('/api/auth', (req, res) => {
  const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  res.json({ url });
});

// Callback for oauth and redirect
app.get('/oauth2callback', (req, res) => {
  const code = req.query.code;
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) {
      console.error('Error getting oAuthToken', err);
      res.status(500);
    } else {
      oauth2Client.setCredentials(tokens);
      res.redirect('/');
    }
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
