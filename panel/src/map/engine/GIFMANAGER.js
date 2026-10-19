
var GIFMANAGER = (function () {
    var my = {};
    my.gifStorage = {};
    my.gifTimes = {};

    my.giftextures = function (name, onFinish) {
        if (!my.gifStorage[name]) {
            //parseName = name;
            my.gifStorage[name] = [];
            my.gifTimes[name] = [];
        } else if (onFinish) {
            onFinish(name);
        }
        return my.gifStorage[name];
    };

    my.OnGifLoaded = null;

    return my;
}());


export default GIFMANAGER;
