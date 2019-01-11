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
    dataChannel: null,
    localID: {
        sdp: null,
        ice: []
    },
    connectInit: function(){
        rtc.peer = new RTCPeerConnection(rtc.config);
        rtc.dataChannel = rtc.peer.createDataChannel('chat');
        rtc.peer.onicecandidate = function onIce(event) { // on address info being introspected
            if(event.candidate){
                console.log('got a candidate ice');
                rtc.localID.ice.push(JSON.stringify(event.candidate));
            } else {
                var stringifiedID = JSON.stringify(rtc.localID);
                document.getElementById('friendAddress').value = stringifiedID;
            }
        };
        rtc.peer.ondatachannel = rtc.newDataChannel;
    },
    instigateConnection: function(){ // return offer to client so they can send it to remote
        rtc.peer.createOffer().then( function onOffer(desc){
            return rtc.peer.setLocalDescription(desc);
        }).then( function onSet(){
            rtc.localID.sdp = JSON.stringify(rtc.peer.localDescription);
        }).catch(console.log);
    },
    handleRemoteID: function(){
        var id = JSON.parse(document.getElementById('friendAddress').value);
        var sdp = JSON.parse(id.sdp);
        rtc.peer.setRemoteDescription(sdp).catch(console.log);
        for(var i = 0; i < id.ice.length; i++){
            rtc.peer.addIceCandidate(JSON.parse(id.ice[i])).catch(console.log);
        }

        if(sdp.type === 'answer'){
            console.log('recieved answer');
        } else {
            rtc.peer.createAnswer().then(function(answer){
                return rtc.peer.setLocalDescription(answer);
            }).then(
                function(){
                    console.log('set local description');
                    rtc.localID.sdp = JSON.stringify(rtc.peer.localDescription);
                    document.getElementById('friendAddress').value = JSON.stringify(rtc.localID);
                }
            );
        }
    },
    openDataChannel: function(){
        rtc.dataChannel.send('what the fuck is happening');
        console.log('channel open');
    },
    closeDataChannel: function(){
        console.log('channel closed');
    },
    onMsg: function(event){
        console.log(event.data);
    },
    sendData: function(msg){
        rtc.dataChannel.send(msg);
    },
    newDataChannel: function(event){
        receiveChannel = event.channel;
        receiveChannel.onerror = console.log;
        receiveChannel.onmessage = rtc.onMsg;
        receiveChannel.onopen = rtc.openDataChannel;
        receiveChannel.onclose = rtc.closeDataChannel;
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
