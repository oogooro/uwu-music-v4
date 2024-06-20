const wrap = require('yt-dlp-wrap-plus').default;
const fs = require('fs-extra');
const { join } = require('node:path');

const ytdlpBinPath = join(__dirname, 'bin/yt-dlp' + (process.platform === 'win32' ? '.exe' : ''));
const binDirPath = join(__dirname, 'bin');

const ytdlp = new wrap(ytdlpBinPath);

const downloadBins = async () => {
    fs.ensureDirSync(binDirPath);
    if (!fs.pathExistsSync(ytdlpBinPath)) await wrap.downloadFromGithub(ytdlpBinPath);
}

downloadBins().then(async () => {
    try {
        console.log(`Downloaded yt-dlp ${await ytdlp.getVersion()}`);
    } catch (error) {
        setTimeout(async () => {
            console.log(`Downloaded yt-dlp ${await ytdlp.getVersion()}`);
        }, 1000);
    }
});