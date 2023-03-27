const video = document.createElement('video');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const output = document.getElementById('output');
const outputCtx = output.getContext('2d');
const upload = document.getElementById('upload');
const loading = document.getElementById('loading');
const download = document.getElementById('download');

const step = 0.5;

const images = [];

let loadOpenCvPromise = null;

const findCounters = (img) => {
    if (img.counters) {
        return img.counters;
    }
    cv.cvtColor(img, img, cv.COLOR_RGBA2GRAY, 0);
    cv.Sobel(img, img, cv.CV_8U, 1, 0, 3);
    cv.threshold(img, img, 0, 255, cv.THRESH_OTSU + cv.THRESH_BINARY);
    const erodeKernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(5, 5)
    );
    const dilateKernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(10, 10)
    );
    cv.dilate(img, img, dilateKernel);
    cv.erode(img, img, erodeKernel);
    cv.Canny(img, img, 10, 10);
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
        img,
        contours,
        hierarchy,
        cv.RETR_CCOMP,
        cv.CHAIN_APPROX_SIMPLE
    );
    const res = [];
    for (let i = 0; i < contours.size(); ++i) {
        const rotatedRect = cv.minAreaRect(contours.get(i));
        res.push(rotatedRect);
    }
    contours.delete();
    hierarchy.delete();
    img.counters = res;
    return img.counters;
};

const getOffsetInfo = (img1, img2) => {
    const counters1 = findCounters(img1);
    const counters2 = findCounters(img2);

    const getKey = (c) =>
        `${c.center.x}_${c.size.width}_${c.size.height}_${c.angle}`;

    const distances = {};
    let maxSameDistance = 0;
    let distance = 0;

    const matches = counters1.filter((t1) => {
        const getDistance = (a, b) => Math.abs(a.center.y - b.center.y);
        const res = counters2.filter((t2) => getKey(t1) === getKey(t2)).sort((a,b) => getDistance(a,t1) - getDistance(b, t1));

        if (res.length) {
            t1.match = res[0];
            const d = res[0].center.y - t1.center.y;
            t1.distance = d;
            if (d) {
                distances[d] ? distances[d]+=1 : distances[d] = 1;
                if (distances[d] > maxSameDistance) {
                    maxSameDistance = distances[d];
                    distance = d;
                }
            }
            return true;
        }
        return false;
    });

    const zeroDistance = matches.filter(t => !t.distance);
    if (zeroDistance.length > matches.length * 0.9) {
        return {
            y1: 0,
            y2: 0
        }
    }


    const goodsMatches = matches.filter(t1 => t1.distance === distance).sort((a,b) => a.center.y - b.center.y);
    if (goodsMatches.length && goodsMatches.length > 0.1 * matches.length) {
        return {
            y1: goodsMatches[0].center.y,
            y2: goodsMatches[0].match.center.y
        }
    }

    return {
        y1: 0,
        y2: 0
    };
};

const spliceImages = () => {
    const imgs = images.map((img) => cv.imread(img));

    const offsetInfos = [];

    for (let i = 0; i < imgs.length - 1; i++) {
        const img1 = imgs[i];
        const img2 = imgs[i + 1];
        const offsetInfo = getOffsetInfo(img1, img2);
        offsetInfos.push(offsetInfo);
    }

    let offset = 0;
    for (let i = 0; i < offsetInfos.length; i++) {
        const {y1, y2} = offsetInfos[i];
        const offsetY = y2 - y1;
        offset += offsetY;
    }

    output.width = images[0].width;
    output.height = images[0].height - offset;


    offset = 0;
    for (let i = 0; i < offsetInfos.length; i++) {
        const {y1, y2} = offsetInfos[i];
        const offsetY = y2 - y1;
        offset += offsetY;

        if (!i) {
            outputCtx.drawImage(images[i], 0, 0);
        }
        if (offsetY) {
            outputCtx.drawImage(
                images[i + 1],
                0, y2,
                images[i + 1].width, images[i + 1].height - y2,
                0, -offset + y2,
                images[i + 1].width, images[i + 1].height - y2
            )
        }
    }
};

const loadOpencv = () => {
    if (loadOpenCvPromise) {
        return loadOpenCvPromise;
    }
    loadOpenCvPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = './opencv.js';
        script.onload = () => {
            cv['onRuntimeInitialized'] = () => {
                resolve();
            };
        };
        document.body.append(script);
    });
    return loadOpenCvPromise;
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
    }
};

const handleLoadData = async () => {
    loading.innerText = 'loading...';
    await Promise.all([loadOpencv(), captureVideo()]);
    spliceImages();
    loading.innerText = '';
    output.style.display = 'block';
    download.download = `longScreenCapture_${Date.now()}.png`;
    download.href = output.toDataURL('image/png');
    download.style.display = 'block';
};

upload.onchange = e => {
    if (e.target.files && e.target.files[0]) {
        const f = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            video.src = e.target.result;
            upload.style.display = 'none';
        }
        reader.readAsDataURL(f);
    }
}

video.onloadeddata = handleLoadData;

loadOpencv();
