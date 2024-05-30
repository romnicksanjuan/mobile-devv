const express = require('express');
const {Register,Welcome,Login,DeleteVideo, Profile, uploadProfile,uploadVideo,streamImage,getAllImages,VideoPage,VideoViews, userIdVideoPage,DisplayVideosVideoPage,DisplayThumbnails,check,CheckToken} = require('../controller/userController')
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
router.get('/checkToken', verifyToken, CheckToken)
router.get('/profile',verifyToken, Profile)
router.put('/profileImage/:userId', uploadProfile)
router.post('/uploadVideo/:userId', upload.single('video'), uploadVideo)
router.get('/images',getAllImages )
router.get('/image/:filename',streamImage )
router.get('/videopage/:videoId' , VideoPage)
router.get('/userIdVideoPage/:metadataId' , userIdVideoPage)
router.get('/displayVideos-VideoPage', DisplayVideosVideoPage)
router.get('/DisplayThumbnails/:filename', DisplayThumbnails)
router.get('/delete-video/:videoId', DeleteVideo)
router.put('/view/:metadataId/:userId', VideoViews)
router.post('/api/check-view-count',check)

module.exports = router