const video = document.createElement('video');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const output = document.getElementById('output');
const upload = document.getElementById('upload');
const loading = document.getElementById('loading');
const download = document.getElementById('download');
const worker = new Worker('./worker.js');

const step = 0.5;

const images = [];

const getOffsetInfo = (img1, img2) => {
    canvas.width = img1.width;
    canvas.height = img1.height;
    ctx.drawImage(img1, 0, 0);
    const data1 = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img2, 0, 0);
    const data2 = ctx.getImageData(0, 0, canvas.width, canvas.height);
    worker.postMessage({
        method: 'getOffsetInfo',
        args: {
            data1,
            data2,
            counters1: img1.counters,
            counters2: img2.counters
        }
    });
    return new Promise(resolve => {
        worker.onmessage = function (event) {
            img1.counters = event.data.counters1;
            img2.counters = event.data.counters2;
            resolve(event.data);
        }
    })
}

const spliceImages = async () => {
    const offsetInfos = [];

    for (let i = 0; i < images.length - 1; i++) {
        const img1 = images[i];
        const img2 = images[i + 1];
        const offsetInfo = await getOffsetInfo(img1, img2);
        // console.log(offsetInfo);
        const percent =  ((i / (images.length - 2)) * 50 + 50).toFixed(0);
        loading.innerText = `loading...(${percent}%)`;
        offsetInfos.push(offsetInfo);
    }

    let offset = 0;
    for (let i = 0; i < offsetInfos.length; i++) {
        const {y1, y2} = offsetInfos[i];
        const offsetY = y2 - y1;
        offset += offsetY;
    }


    canvas.width = images[0].width;
    canvas.height = images[0].height - offset;


    offset = 0;
    for (let i = 0; i < offsetInfos.length; i++) {
        const {y1, y2} = offsetInfos[i];
        const offsetY = y2 - y1;
        offset += offsetY;

        if (!i) {
            ctx.drawImage(images[i], 0, 0);
        }
        if (offsetY) {
            ctx.drawImage(
                images[i + 1],
                0, y2,
                images[i + 1].width, images[i + 1].height - y2,
                0, -offset + y2,
                images[i + 1].width, images[i + 1].height - y2
            )
        }
    }
};

const capture = async (second) => {
    video.currentTime = second;
    await new Promise((resolve) => {
        video.onseeked = resolve;
    });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    await new Promise((resolve) => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.src = url;
            img.onload = () => {
                resolve();
            };
            images.push(img);
        });
    });
};

const captureVideo = async () => {

    for (let i = 0; i <= video.duration; i += step) {
        await capture(i);
        const percent = ((i / video.duration) * 50).toFixed(0);
        loading.innerText = `loading...(${percent}%)`;
    }
};

const handleLoadData = async () => {
    loading.innerText = `loading...(0%)`;
    await captureVideo();
    loading.innerText = `loading...(50%)`;
    await spliceImages();
    loading.innerText = '';
    const url = canvas.toDataURL('image/png');
    output.style.display = 'block';
    output.src = url;
    download.download = `longScreenCapture_${Date.now()}.png`;
    download.href = url;
    download.style.display = 'block';
};

upload.onchange = e => {
    if (e.target.files && e.target.files[0]) {
        loading.innerText = 'loading...';
        const f = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            video.muted = true;
            video.autoplay = true;
            video.src = e.target.result;
            upload.style.display = 'none';
        }
        reader.readAsDataURL(f);
    }
}

video.onloadeddata = handleLoadData;