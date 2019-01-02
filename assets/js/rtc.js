// rtc.js ~ copyright 2019 Paul Beaudet ~ MIT License

var rtc = {
    connectConfig: {
        'iceServers': [
            {'urls': 'stun:stun.stunprotocol.org:3478'},
            {'urls': 'stun:stun.l.google.com:19302'}
        ]
    },
    peer: null,
    getICEd: function(){
        rtc.peer = new RTCPeerConnection(rtc.connectConfig);
        rtc.peer.onicecandidate = function (event) { // on address info being introspected
            console.log('ice event?');
            if (event.candidate != null) {
                var iceInfo = JSON.stringify(event.candidate);
                console.log(iceInfo);
            } else {console.log('no more ice for you');}
        }; // null === finished finding info to describe ones own address, ie "canidate" address paths
    }
};

var connect = {
    friend: function(){
        console.log('trying to find you a friend so u no forever lonely');
    }
};

var app = {
    init: function(){
        document.addEventListener('DOMContentLoaded', function(){
            rtc.getICEd();
            console.log('rtc.js loaded');
        });
    }
};

app.init();
