// rtc.js ~ copyright 2019 Paul Beaudet ~ MIT License

var rtc = {
    config: {
        'iceServers': [
            {'urls': 'stun:stun.stunprotocol.org:3478'},
            {'urls': 'stun:stun.l.google.com:19302'}
        ]
    },
    server: null,
    peer: null,
    remoteConnection: null,
    sendChannel: null,
    localID: {
        sdp: null,
        ice: []
    },
    connectInit: function(){
        rtc.peer = new RTCPeerConnection(rtc.config);
        rtc.sendChannel = rtc.peer.createDataChannel('sendDataChannel');
        rtc.peer.onicecandidate = function onIce(event) { // on address info being introspected
            if(event.candidate){
                rtc.localID.ice.push(JSON.stringify(event.candidate));
            } else {
                var stringifiedID = JSON.stringify(rtc.localID);
                document.getElementById('friendAddress').value = stringifiedID;
            }
        };
        rtc.sendChannel.onopen = rtc.sendChannelChange;
        rtc.sendChannel.onclose = rtc.sendChannelChange;
    },
    instigateConnection: function(){ // return offer to client so they can send it to remote
        rtc.peer.createOffer().then( function onOffer(desc){
            return rtc.peer.setLocalDescription(desc);
        }).then( function onSet(){
            rtc.localID.sdp = JSON.stringify(rtc.peer.localDescription);
        }).catch(console.log);
    },
    handleRemoteID: function(){
        id = JSON.parse(document.getElementById('friendAddress').value);
        rtc.peer.setRemoteDescription(JSON.parse(id.sdp)).catch(console.log);
        for(var i = 0; i < id.ice.length; i++){
            rtc.peer.addIceCandidate(JSON.parse(id.ice[i])).catch(console.log);
        }
        rtc.peer.createAnswer().then(function(desc){
            document.getElementById('friendAddress').value = JSON.stringify(desc);
        });
    },
    sendChannelChange: function(){
        console.log('channel state ' + rtc.sendChannel.readyState);
    }
};

var video = {
    stream: null,
    get: function(){
        if(navigator.getUserMedia){
            navigator.getUserMedia({video: true, audio: false}, function(stream){
                video.stream = stream;
                video.remoteStream(stream);
            }, console.log);
        } else { console.log('Telepresence, not supported on this device'); }
    },
    remoteStream: function(event){
        document.getElementById('remoteVid').srcObject = event;
        // document.getElementById('remoteVid').src = window.URL.createObjectURL(event.stream);
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
            // video.get();
            rtc.connectInit();
        });
    }
};

app.init();
