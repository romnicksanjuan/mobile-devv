const express = require('express');
const {Register,Welcome,Login,DeleteVideo, Profile, uploadProfile,uploadVideo,streamImage,getAllImages,VideoPage, userIdVideoPage,DisplayVideosVideoPage,DisplayThumbnails} = require('../controller/userController')
const verifyToken = require('../awt/awt')
const multer = require('multer');


const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.get('/', Welcome )
router.post('/register', Register)
router.post('/login', Login)
router.get('/profile',verifyToken, Profile)
router.put('/profileImage/:userId', uploadProfile)
router.post('/uploadVideo/:userId', upload.single('video'), uploadVideo)
router.get('/images',getAllImages )
router.get('/image/:filename',streamImage )
router.get('/videopage/:videoId' , VideoPage)
router.get('/userIdVideoPage/:thumnailId' , userIdVideoPage)
router.get('/displayVideos-VideoPage', DisplayVideosVideoPage)
router.get('/DisplayThumbnails/:filename', DisplayThumbnails)
router.get('/delete-video/:videoId', DeleteVideo)
module.exports = router