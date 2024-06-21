const express = require('express');
const Jimp = require('jimp');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');



const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  methods: 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  credentials: true,
  allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
   optionsSuccessStatus: 204,
}));
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.post('/embed', upload.single('image'), async (req, res) => {
    const message = req.body.message;
    const imagePath = req.file.path;

    try {
        const image = await Jimp.read(imagePath);
        const binaryMessage = message.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join('') + '00000000';

        let dataIndex = 0;
        // console.log(image.bitmap.height);
        // console.log(image.bitmap.width);
        for (let y = 0; y < image.bitmap.height; y++) {
            for (let x = 0; x < image.bitmap.width; x++) {
                if (dataIndex < binaryMessage.length) {
                    const pixelColor = Jimp.intToRGBA(image.getPixelColor(x, y));
                    pixelColor.r = (pixelColor.r & 0xFE) | parseInt(binaryMessage[dataIndex], 2);
                    dataIndex++;
                    image.setPixelColor(Jimp.rgbaToInt(pixelColor.r, pixelColor.g, pixelColor.b, pixelColor.a), x, y);
                }
            }
        }

        const outputImagePath = `output-${Date.now()}.png`;
        await image.writeAsync(outputImagePath);
        res.download(outputImagePath, async () => {
            await fs.remove(imagePath);
            await fs.remove(outputImagePath);
        });
    } catch (error) {
        res.status(500).send('An error occurred');
    }
});

app.post('/extract', upload.single('image'), async (req, res) => {
    const imagePath = req.file.path;

    try {
        const image = await Jimp.read(imagePath);
        let binaryMessage = '';
        // console.log(image.bitmap.height);
        // console.log(image.bitmap.width);
        for (let y = 0; y < image.bitmap.height; y++) {
            for (let x = 0; x < image.bitmap.width; x++) {
                const pixelColor = Jimp.intToRGBA(image.getPixelColor(x, y));
                binaryMessage += (pixelColor.r & 1).toString();
            }
        }

        const allBytes = binaryMessage.match(/.{1,8}/g);
        const message = allBytes.map(byte => String.fromCharCode(parseInt(byte, 2))).join('');
        const extractedMessage = message.split('\0')[0];

        res.send({ message: extractedMessage });
        await fs.remove(imagePath);
    } catch (error) {
        res.status(500).send('An error occurred');
    }
});

app.listen(3001, () => {
    console.log('Server started on http://localhost:3001');
});
