const User = require('../model/user')
const Video = require('../model/video')
const jwt = require('jsonwebtoken')


const multer = require('multer');
const { MongoClient, GridFSBucket } = require('mongodb');
const { ObjectId } = require('bson')
const fs = require('fs');
const path = require('path');

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const upload = multer({ storage: multer.memoryStorage() });

const mongoURI = 'mongodb+srv://romnick:1234@romnickdb.e14diyv.mongodb.net';
const dbName = 'mobile-dev';
let db, bucketVideos, bucketImages;

MongoClient.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        db = client.db(dbName);
        bucketVideos = new GridFSBucket(db, { bucketName: 'videos' });
        bucketImages = new GridFSBucket(db, { bucketName: 'thumbnails' });

        console.log('Connected to database');
    })
    .catch(err => console.error('Failed to connect to the database', err));

const secretKey = 'nick14'

const Welcome = (req, res) => {
    res.json({ message: 'This is Welcome Page' })
}

const Register = async (req, res) => {
    const { name, username, password, profileImage } = req.body;
    console.log(req.body)

    try {
        const user = await User.findOne({ username })
        if (user) {
            return res.json({ messageError: 'User Already Exist' })
        }
        const saveUser = new User({ name, username, password, profileImage })
        await saveUser.save();
        res.json({ message: 'registered success' })

    } catch (error) {
        console.error(error)
    }
}

const Login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username })

        if (user) {
            if (user.password !== password) {
                res.json({ error: 'Username or Password Incorrect' })
            } else {

                const token = jwt.sign({
                    userId: user._id,
                    name: user.name,
                    username: user.username,
                    // profileImage:user.profileImage
                }, secretKey,);

                res.status(200).json({ message: 'Login Successfully', token })
            }
        } else {
            res.json({ error: 'Username or Password Incorrect' })
        }
    } catch (error) {
        console.log(error)
    }
}


const Profile = async (req, res) => {
    const _id = req.userId

    try {
        const user = await User.findOne({ _id })
        // console.log(user)
        return res.json(user)
    } catch (error) {
        console.log(error)
    }

}

const uploadProfile = async (req, res) => {
    const _id = req.params.userId
    console.log(_id)

    const base64Image = req.body.uploadProfile
    // console.log(base64Image)
    try {
        await User.findByIdAndUpdate({ _id }, { profileImage: base64Image })
        res.status(200).json({ message: 'Image Uploaded Successfully' })
        console.log('update success')
    } catch (error) {
        console.log(error)
    }
}


const uploadVideo = async (req, res) => {
    const videoInfo = JSON.parse(JSON.stringify(req.body))
    console.log('title:', videoInfo)

    const { userId } = req.params
    console.log(userId)
    const videoBuffer = req.file.buffer;
    const videoFilename = req.file.originalname;
    const thumbnailFilename = `${videoFilename}_thumbnail.png`;
    const thumbnailPath = `thumbnail_${Date.now()}.png`;

    const info = {
        userId: userId,
        videoTitle: videoInfo.title
    }

    console.log('info', info)
    try {
        // Generate thumbnail
        const thumbnailBuffer = await generateThumbnail(videoBuffer, thumbnailPath);
        // console.log('thumbnailBuffer:', thumbnailBuffer)

        // Upload video to GridFS
        const videoUploadStream = bucketVideos.openUploadStream(videoFilename, {
            contentType: req.file.mimetype,

        });
        videoUploadStream.write(videoBuffer);

        videoUploadStream.end();
        videoUploadStream.on('finish', async () => {
            const vidFilename = videoUploadStream.filename
            console.log('vidFilename:', vidFilename)
            const videoID = videoUploadStream.id
            console.log('videoID:', videoUploadStream.id)

            // Upload thumbnail to GridFS

            await saveThumbnailToGridFS(thumbnailBuffer, bucketImages, videoID, info);

            // Store metadata associating video and thumbnail
            const videoId = videoUploadStream.id;




            console.log('videoId:', videoId)
            fs.unlinkSync(thumbnailPath);

            res.send('Upload successful');

        });

    } catch (err) {
        console.error('Error processing upload:', err);
        res.status(500).send('Error processing upload');
    }

}

async function generateThumbnail(videoBuffer, thumbnailPath) {
    return new Promise((resolve, reject) => {
        const tempFilePath = `temp_${Date.now()}.mp4`;


        fs.writeFile(tempFilePath, videoBuffer, (err) => {
            if (err) {
                return reject(err);
            }

            ffmpeg(tempFilePath)
                .screenshots({
                    timestamps: [10],
                    filename: thumbnailPath,
                    folder: './',
                    size: '320x240'
                })
                .on('end', () => {
                    fs.unlinkSync(tempFilePath); // Remove temp video file
                    resolve(thumbnailPath);
                })
                .on('error', (err) => {
                    fs.unlinkSync(tempFilePath); // Remove temp video file
                    reject(err);
                });
        });


    });
}


async function saveThumbnailToGridFS(thumbnailPath, bucketImages, videoID, info) {
    return new Promise((resolve, reject) => {
        const uploadStream = bucketImages.openUploadStream(thumbnailPath, {
            metadata: {
                videoID: videoID,
                userId: info.userId,
                videoTitle: info.videoTitle
            }
        });
        console.log('thumbnailId:', uploadStream.id)
        fs.createReadStream(thumbnailPath)
            .pipe(uploadStream)
            .on('error', (err) => {
                reject(err);
            })
            .on('finish', (file) => {
                console.log('thubmnail upload successfully')
                resolve(file);
            });
    });
}


const getAllImages = async (req, res) => {

    try {
        const images = await db.collection('thumbnails.files').find().toArray();
        if (!images || images.length === 0) {
            return res.status(404).json({ message: 'No files found' });
        }

        const videosWithAuthors = await Promise.all(images.map(async (file) => {

            const author = await db.collection('users').findOne({ _id: new ObjectId(file.metadata.userId) });
            // console.log(file._id)
            return {
                videoId: file.metadata.videoID,
                userId: author._id,
                thumnailId: file._id,
                filename: file.filename,
                videoTitle: file.metadata.videoTitle,
                authorName: author ? author.name : 'Unknown',
                profileImage: author ? author.profileImage : 'Unknown',
            };

        }));
        res.json(videosWithAuthors);
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
}

const streamImage = (req, res) => {

    const file = bucketImages.openDownloadStreamByName(req.params.filename);
    file.on('error', err => {
        res.status(404).send('Image not found');
    });
    file.pipe(res);
}



const VideoPage = async (req, res) => {


    // const {videoId} = req.params
    const { videoId } = req.params
    // console.log('v:', videoId)
    try {
        const range = req.headers.range;
        console.log(range)
        if (!range) {
            return res.status(400).send('Requires Range header');
        }

        const videoFile = await bucketVideos.find({ _id: new ObjectId(videoId) }).toArray()
        // console.log('videoFile:' , videoFile)

        const CHUNK_SIZE = 10 ** 6 // 1MB
        const video = videoFile[0];
        const videoSize = video.length;
        const start = Number(range.replace(/\D/g, ''));
        const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

        const contentLength = end - start + 1;
        const headers = {
            'Content-Range': `bytes ${start}-${end}/${videoSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': contentLength,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, headers);

        const downloadStream = bucketVideos.openDownloadStream(new ObjectId(videoId), {
            start,
            end: end + 1,
        });

        downloadStream.pipe(res);

    } catch (error) {
        res.status(500).send(error.message);
    }

}

const userIdVideoPage = async (req, res) => {
    try {
        const video = await db.collection('thumbnails.files').findOne({ _id: new ObjectId(req.params.thumnailId) })
        // console.log('usrId:', video.metadata.userId)
        const user = await db.collection('users').findOne({ _id: new ObjectId(video.metadata.userId) })
        // console.log('user:',user)
        const data = {
            videoTitle: video.metadata.videoTitle,
            profileImage: user.profileImage,
            name: user.name
        }
        // console.log('title:',data)
        res.json(data)
    } catch (error) {
        console.log(error)
    }
}

const DisplayVideosVideoPage = async (req, res) => {
    // console.log('video page')
    try {
        const images = await db.collection('thumbnails.files').find().toArray();

        const getFiles = images.map(file => ({
            filename: file.filename,
            VideoTitle: file.metadata.videoTitle
        }))
        // console.log(getFiles)
        res.json(getFiles)
    } catch (error) {
        console.log(error)
    }
}

const DisplayThumbnails = (req, res) => {
    console.log('filename:', req.params.filename)
    const file = bucketImages.openDownloadStreamByName(req.params.filename)
    console.log('file:', file)
    file.on('error', err => {
        console.log(err)
    })
    file.pipe(res)
}


module.exports = { Register, Welcome, Login, Profile, uploadProfile, uploadVideo, streamImage, getAllImages, VideoPage, userIdVideoPage, DisplayVideosVideoPage, DisplayThumbnails }