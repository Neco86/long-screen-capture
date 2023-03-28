importScripts('./opencv.js');

function HTMLImageElement() {};

function HTMLCanvasElement(data) {
    this.width = data.width;
    this.height = data.height;
    this.data = data;
    this.getContext = () => {
        return {
            getImageData: () => this.data
        };
    }
};


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
            y2: 0,
            counters1,
            counters2
        }
    }


    const goodsMatches = matches.filter(t1 => t1.distance === distance).sort((a,b) => a.center.y - b.center.y);
    if (goodsMatches.length && goodsMatches.length > 0.1 * matches.length) {
        return {
            y1: goodsMatches[0].center.y,
            y2: goodsMatches[0].match.center.y,
            counters1,
            counters2
        }
    }

    return {
        y1: 0,
        y2: 0,
        counters1,
        counters2
    };
};


self.addEventListener('message', function (e) {
    if (e.data && e.data.method === 'getOffsetInfo') {
        const {data1, data2, counters1, counters2} = e.data.args;
        const canvas1 = new HTMLCanvasElement(data1);
        const img1 = cv.imread(canvas1);
        img1.counters = counters1;
        const canvas2 = new HTMLCanvasElement(data2);
        const img2 = cv.imread(canvas2);
        img2.counters = counters2;
        const info = getOffsetInfo(img1, img2);
        self.postMessage(info);
    }
}, false);