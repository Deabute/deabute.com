// rtctest.js ~ copyright 2019 Paul Beaudet ~ MIT License
// rtcSignal version - 1.0.13
// This test requires at least two browser windows, to open a data connection between two peers
var rtc = { // stun servers in config allow client to introspect a communication path to offer a remote peer
    config: {'iceServers': [ {'urls': 'stun:stun.stunprotocol.org:3478'}, {'urls': 'stun:stun.l.google.com:19302'} ]},
    peer: null,                      // placeholder for parent webRTC object instance
    init: function(onSetupCB){
        rtc.peer = new RTCPeerConnection(rtc.config);           // create new instance for local client
        if(media.stream){
            media.stream.getTracks().forEach(function(track){rtc.peer.addTrack(track, media.stream);});
        } else { console.log('Connecting before media obtained');}
        rtc.peer.ontrack = function(event){media.output.srcObject = event.streams[0];};
        dataPeer.channel = rtc.peer.createDataChannel('chat');  // Creates data endpoint for client's side of connection
        rtc.peer.onicecandidate = function onIce(event) {       // on address info being introspected (after local discription is set)
            if(event.candidate){                                // canididate property denotes data as multiple canidates can resolve
                ws.send({type: 'ice', canidate: event.candidate});
            }                                                   // null event.canidate means we finished recieving canidates
        };    // Also note that sdp is going to be negotiated first regardless of any media being involved. its faster to resolve
        rtc.peer.ondatachannel = dataPeer.newChannel;           // creates data endpoints for remote peer on rtc connection
        onSetupCB();                                            // create and offer or answer depending on what intiated
    },
    createOffer: function(){                                                  // extend offer to client so they can send it to remote
        var offerConfig = { offerToReceiveAudio: 1, offerToReceiveVideo: 0 }; // can be passed to createOffer
        rtc.peer.createOffer(offerConfig).then( function onOffer(desc){       // get sdp data to show user, that will share with a friend
            return rtc.peer.setLocalDescription(desc);                        // note what sdp data self will use
        }).then( function onSet(){
            ws.send({type: 'sdp', sdp: rtc.peer.localDescription, peerID: ws.friend}); // send offer to friend
        });
    },
    onSdp: function(sdp){
        rtc.peer.setRemoteDescription(sdp);
        if(sdp.type === 'offer'){                               // create an answer when type is offer
            rtc.peer.createAnswer().then(function onAnswer(answer){ // create answer to remote peer that offered
                return rtc.peer.setLocalDescription(answer);    // set that offer as our local discripion
            }).then(function onOfferSetDesc(){
                ws.send({type: 'sdp', sdp: rtc.peer.localDescription, peerID: ws.friend}); // send offer to friend
            });                                                 // note answer is shown to user in onicecandidate event above once resolved
        }                                                       // ice canidates start resolving after local discription is set
    },
    connect: function(peer){                                    // what to do when a friends session id is entered
        ws.friend = peer ? peer : app.sessionInput.value;       // set id to target friend value to use when ice canidates are gathered
        rtc.init(rtc.createOffer);
    }
};

var dataPeer = {
    channel: null,
    connected: false,
    newChannel: function(event){
        receiveChannel = event.channel;                          // recieve channel events handlers created on connection
        receiveChannel.onerror = function onError(){};           // handling errors could be a good idea
        receiveChannel.onmessage = function onMsg(event){
            var res = dataPeer.incoming(event.data);
            if(res.type){ws.send(res);}
        };
        receiveChannel.onopen = function onOpen(){
            dataPeer.connected = true;
            dataPeer.send({type: 'connect'});
        };    // handle events upon opening connection
        receiveChannel.onclose = function onClose(){dataPeer.connected = false;}; // doenst seem to work on closing a tab
    },
    incoming: function(message){               // handle incoming socket messages
        var req = {type: null};                // request
        try {req = JSON.parse(message);}       // probably should be wrapped in error handler
        catch(error){}                         // if error we don't care there is a default object
        var res = {type: null};                // response
        if(req.type === 'disconnect'){
            ws.friend = '';
            app.changeMode();
            rtc.peer.close();
            rtc.peer = null;
        } else if(req.type === 'connect'){
            app.changeMode();
        } else {
            console.log(message);        // will log message regardless of whether it was parsed
        }
        return res;
    },
    send: function(sendObj){
        try{sendObj = JSON.stringify(sendObj);} catch(error){console.log(error);}
        if(dataPeer.connected){
            dataPeer.channel.send(sendObj);
            return true;
        } else {
            console.log('disconnected from peer');
            return false;
        }
    }
};

var ws = {
    id: null,          // id of this connection set by server
    friend: '',        // id of peer to connect with
    instance: null,    // placeholder for websocket object
    connected: false,  // set to true when connected to server
    init: function(server){
        ws.instance = new WebSocket(server);
        ws.instance.onopen = function(event){
            ws.connected = true;
            ws.instance.onmessage = function(event){
                var res = ws.incoming(event.data);
                if(res.type){ws.send(res);}
            };
            ws.onclose = function onSocketClose(){ws.connected = false;};
            ws.onerror = function onSocketError(){console.log(error);};
        };
    },
    incoming: function(message){         // handle incoming socket messages
        var req = {type: null};          // request
        try {req = JSON.parse(message);} // probably should be wrapped in error handler
        catch(error){}                   // if error we don't care there is a default object
        var res = {type: null};          // response
        if(req.type === 'token'){
            ws.id = req.data;
            app.sessionID.innerHTML = req.data; // show "session id" to share turn out to conviently double a client id
        } else if(req.type === 'sdp'){
            ws.friend = req.peerID;
            if(req.sdp.type === 'offer'){
                rtc.init(function onInit(){rtc.onSdp(req.sdp);});
            } else { rtc.onSdp(req.sdp);}
        } else if(req.type === 'ice'){
            rtc.peer.addIceCandidate(req.canidate);
        } else if(req.type === 'nomatch'){
            app.inputStage++;
            if(app.inputStage > app.inputStage.length){app.inputStage = 0;}
            app.inputLabelEl.innerHTML = app.inputLabelText[app.inputStage];
        } else if(req.type === 'disconnect'){
            app.changeMode();
        } else {
            console.log(message);        // will log message regardless of whether it was parsed
        }
        return res;
    },
    send: function(msg){
        try{msg = JSON.stringify(msg);} catch(error){console.log(error);}
        if(ws.connected){
            ws.instance.send(msg);
            return true;
        } else {
            console.log('disconnect issue');
            return false;
        }
    }
};

var media = {
    output: document.getElementById('mediaStream'),
    stream: null,
    init: function(onMedia){ // get user permistion to use media
        var onMediaCallback = onMedia ? onMedia : function noSoupForYou(){};
        navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(function onMedia(mediaStream){
            media.stream = mediaStream;
            var audioTracks = mediaStream.getAudioTracks();
            if(audioTracks.length){
                if(audioTracks[0].enabled){
                } else{console.log('Microphone muted');}
            } else {console.log('woah! no audio');}
            onMediaCallback(mediaStream);
        }).catch(function onNoMedia(error){onMediaCallback(error);});
    }
};

var app = {
    inputStage: 0,
    inputLabelText: [
        'Paste friend id',
        'Sorry try a different id',
        'They might be chatting with someone'
    ],
    modes: [
        'Enter name and connect mic',
        'Enter friend name and talk (empty for whomever)',
        'end call'
    ],
    inputLabelEl: document.getElementById('inputLabel'),
    chatMode: false, // Determites if showing talkin mode or connecting mode
    modeButton: document.getElementById('modeButton'),
    sessionID: document.getElementById('sessionid'),
    sessionInput: document.getElementById('sessionInput'),
    setupBox: document.getElementById('setupBox'),
    init: function(){
        document.addEventListener('DOMContentLoaded', function(){       // wait till dom is loaded before manipulating it
            media.init();                                               // start making rtc connection once we get media
            ws.init(document.getElementById('socketserver').innerHTML); // grab socket server from compiled jekyll temlpate for this env
            document.getElementById('socketserver').style.visibility = 'hidden'; // hide, not sure how to do this in html
        });
        document.addEventListener('keyup', function(event){ // map enter button to sending message
            if(event.keyCode === 13){app.sendMsg();}
        });
    },
    mode: function(){ // Enter name / connect mic then enter friend name / connect
        if(app.chatMode){
            app.endChat();
        } else {
            rtc.connect();
        }
    },
    endChat: function(){
        dataPeer.send({type: 'disconnect'});
        ws.send({type: 'disconnect'});
        ws.friend = '';
        rtc.peer.close();
        rtc.peer = null;
        app.changeMode();
    },
    changeMode: function(){ // change between chat or connect view
        app.chatMode = !app.chatMode;
        if(app.chatMode){
            app.modeButton.innerHTML = 'disconnect';
            app.setupBox.style.visibility = 'hidden';
        } else {
            app.modeButton.innerHTML = 'connect';
            app.setupBox.style.visibility = 'visible';
        }
    }
};

app.init(); // start application
