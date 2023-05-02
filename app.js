const express = require('express');
const NeDB = require('nedb');
const multer = require('multer');
const path = require('path');
const app = express();
const crypto = require('crypto');
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const usersDB = new NeDB({ filename: 'userdata/users.db', autoload: true });
const imagesDB = new NeDB({ filename: 'userdata/images.db', autoload: true });

const storage = multer.diskStorage({
  destination: 'userdata/uploads/',
  filename: (req, file, cb) => {
    const uuid = crypto.randomUUID();
    cb(null, uuid);
  },
});

const upload = multer({ storage: storage });

app.post('/signup', (req, res) => {
  const name = req.body.name;
  const userUUID = crypto.randomUUID();

  usersDB.insert({ uuid: userUUID, name: name }, (err, newUser) => {
    if (err) return res.status(500).send(err);
    res.json({ uuid: userUUID });
  });
});

app.get('/users/:id', (req, res) => {
  usersDB.findOne({uuid: req.params.id}, (err, users) => {
    if(err) return res.status(500).send(err);
    if (!user) return res.status(404).send('User not found');
    res.json(users);
  });
});

app.post('/upload', upload.single('image'), (req, res) => {
  const userUUID = req.headers['x-user-uuid'];
  const caption = req.body.caption || '';
  const imagePath = req.file.path;
  const imageUUID = req.file.path.split(".")[0].split("/")[2];
  const timestamp = new Date();
  const fileType = req.file.mimetype;

  usersDB.findOne({ uuid: userUUID }, (err, user) => {
    if (err) return res.status(500).send(err);
    if (!user) return res.status(404).send('User not found');

    imagesDB.insert({
      uuid: imageUUID,
      path: imagePath,
      name: user.name,
      userUUID: userUUID,
      caption: caption,
      timestamp: timestamp,
      fileType: fileType,
    }, (err, newImage) => {
      if (err) return res.status(500).send(err);
      res.json({ uuid: imageUUID, path: imagePath });
    });

    // Inside the imagesDB.insert callback, after res.json(...)
    io.emit('newImage', {
        uuid: imageUUID,
        path: imagePath,
        name: user.name,
        userUUID: userUUID,
        caption: caption,
        timestamp: timestamp,
        fileType: fileType,
    });
  });

    
  
});

app.get('/images', (req, res) => {
    imagesDB.find({}).sort({ timestamp: 1 }).exec((err, images) => {
      if (err) return res.status(500).send(err);
      res.json(images);
    });
  });

app.get('/images/file/:uuid', (req, res) => {

    const uuid = req.params.uuid;
    imagesDB.findOne({ uuid: uuid }, (err, image) => {
        if (err) return res.status(500).send(err);
        if (!image) return res.status(404).send('Image not found');

        res.setHeader('Content-Type', image.fileType);


        res.sendFile(path.join(__dirname, image.path));
    });

});

  

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
app.get('/display', (req, res) => {
    res.sendFile(__dirname + '/public/image_display.html');
  });

http.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
