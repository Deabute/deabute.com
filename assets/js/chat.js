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
            ws.send({type: 'offer', sdp: rtc.peer.localDescription, friendName: ws.friendName}); // send offer to friend
        });
    },
    onOffer: function(sdp){
        rtc.peer.setRemoteDescription(sdp);
        rtc.peer.createAnswer().then(function onAnswer(answer){ // create answer to remote peer that offered
            return rtc.peer.setLocalDescription(answer);        // set that offer as our local discripion
        }).then(function onOfferSetDesc(){
            ws.send({type: 'answer', sdp: rtc.peer.localDescription, friendId: ws.friendId}); // send offer to friend
        });                                                     // note answer is shown to user in onicecandidate event above once resolved
    },
    connect: function(){                                        // what to do when a friends session id is entered
        ws.friendName = app.nameInput.value;                    // set id to target friend value to use when ice canidates are gathered
        app.nameInput.value = '';
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
            app.changeMode(1);                 // jump to startin point
        } else if(req.type === 'connect'){
            app.changeMode(4); // Stage 3 mode change
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
    friendName: '',    // id of peer to connect with
    friendId: '',      // socket id of peer connection
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
        } else if(req.type === 'offer'){
            ws.friendId = req.id;
            rtc.init(function onInit(){rtc.onOffer(req.sdp);});
        } else if(req.type === 'answer'){
            rtc.peer.setRemoteDescription(req.sdp);
        } else if(req.type === 'ice'){
            rtc.peer.addIceCandidate(req.canidate);
        } else if(req.type === 'nomatch'){
            console.log('no matches found');
        } else {
            // console.log(message);        // will log message regardless of whether it was parsed
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
    modes: [
        'ending connection',
        'Enter name and allow Microphone',
        'Connect (empty for whomever)',
        'connecting...',
        'disconnect'
    ],
    chatMode: 1, // Determites if showing talkin mode or connecting mode
    modeButton: document.getElementById('modeButton'),
    nameInput: document.getElementById('nameInput'),
    discription: document.getElementById('discription'),
    init: function(){
        document.addEventListener('DOMContentLoaded', function(){       // wait till dom is loaded before manipulating it
            app.modeButton.innerHTML = app.modes[1];
            ws.init(document.getElementById('socketserver').innerHTML); // grab socket server from compiled jekyll temlpate for this env
            document.getElementById('socketserver').style.visibility = 'hidden'; // hide, not sure how to do this in html
        });
    },
    changeMode: function(chatMode){ // change between chat or connect view
        app.chatMode = chatMode ? chatMode : app.chatMode + 1;
        if(app.chatMode === app.modes.length){app.chatMode = 0;}
        if(app.chatMode === 0){
            dataPeer.send({type: 'disconnect'}); // tell friend we are done
            ws.send({type: 'disconnect'});       // tell server we are done
            app.changeMode(1);                   // jump to starting point
        } else if(app.chatMode === 1){ // end chat button was press
            ws.friendName = '';
            ws.friendId = '';
            rtc.peer.close();
            rtc.peer = null;
            app.discription.style.visibility = 'visible';
            if(media.stream){app.changeMode(2);}
            else { app.modeButton.innerHTML = app.modes[1]; }
        } else if(app.chatMode === 2){
            if(!media.stream){
                media.init();
                ws.send({type: 'name', name: app.nameInput.value});
            }
            app.nameInput.value = '';
            app.modeButton.innerHTML = app.modes[2];
        } else if(app.chatMode == 3){
            if(media.stream){
                rtc.connect();
                app.modeButton.innerHTML = app.modes[3];
            } else {
                app.modeButton.innerHTML = 'No voice detected';
                app.chatMode = 2;
            }
        } else if (app.chatMode === 4){
            app.discription.style.visibility = 'hidden';
            app.modeButton.innerHTML = app.modes[4];
        } else {console.log('ya daw gone messed up');}
    }
};

app.init(); // start application
