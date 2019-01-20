// rtctest.js ~ copyright 2019 Paul Beaudet ~ MIT License
// This test requires at least two browser windows, to open a data connection between two peers
var rtc = { // stun servers in config allow client to introspect a communication path to offer a remote peer
    config: {'iceServers': [ {'urls': 'stun:stun.stunprotocol.org:3478'}, {'urls': 'stun:stun.l.google.com:19302'} ]},
    peer: null,                      // placeholder for parent webRTC object instance
    localID: { sdp: null, ice: [] }, // package for user to send off to a friend they want to connect with
    init: function(mediaStream, onSetupCB){
        rtc.peer = new RTCPeerConnection(rtc.config);           // create new instance for local client
        rtc.handleMedia(mediaStream);                           // function for adding media tracks to our rtc connection
        dataPeer.channel = rtc.peer.createDataChannel('chat');   // Creates data endpoint for client's side of connection
        rtc.peer.onicecandidate = function onIce(event) {       // on address info being introspected (after local discription is set)
            if(event.candidate){                                // canididate property denotes data as multiple canidates can resolve
                rtc.localID.ice.push(event.candidate);          // Add a canidate to an array that we can package up and show user
            } else {                                            // null event.canidate means we finished recieving canidates
                ws.send({type: 'offer', friend:ws.friend, offer: rtc.localID});
            } // NOTE we show connection info to share once ice canidates are complete this can be slower to find a route
        };    // Also note that sdp is going to be negotiated first regardless of any media being involved. its faster to resolve
        rtc.peer.ondatachannel = dataPeer.newChannel;            // creates data endpoints for remote peer on rtc connection
        onSetupCB();                                             // create and offer or answer depending on what intiated
    },
    handleMedia: function(mediaStream){
        if(mediaStream){
            // rtc.peer.addStream(mediaStream);
            var audioTracks = mediaStream.getAudioTracks();
            // audioTracks.forEach(function(track){console.log(track);});
            if(audioTracks.length){
                if(audioTracks[0].enabled){}
                else{console.log('Microphone muted');}
                rtc.peer.addTrack(audioTracks[0], mediaStream);
                // audioTracks.forEach(function(track){rtc.peer.addTrack(track, mediaStream);});
            } else {console.log('woah! no audio');}
        }
        // rtc.peer.ontrack = media.ontrack;
        rtc.peer.addEventListener('track', media.ontrack);
    },
    createOffer: function(){                                    // extend offer to client so they can send it to remote
        var offerConfig = { offerToReceiveAudio: 1, offerToReceiveVideo: 0 }; // can be passed to createOffer
        rtc.peer.createOffer().then( function onOffer(desc){    // get sdp data to show user, that will share with a friend
            return rtc.peer.setLocalDescription(desc);          // note what sdp data self will use
        }).then( function onSet(){
            rtc.localID.sdp = rtc.peer.localDescription;        // set local discription into something that can be shared
        });
    },
    offersAndAnswers: function(id){                             // method that gets called in recieving case with shared data provided
        rtc.peer.setRemoteDescription(id.sdp);                  // apply remote peer's sdp data
        for(var i = 0; i < id.ice.length; i++){
            rtc.peer.addIceCandidate(id.ice[i]);                // add ice canidates to figure a common with least hops
        }
        if(id.sdp.type === 'offer'){                            // create an answer when type is offer
            rtc.peer.createAnswer().then(function onAnswer(answer){ // create answer to remote peer that offered
                return rtc.peer.setLocalDescription(answer);    // set that offer as our local discripion
            }).then(function onOfferSetDesc(){
                rtc.localID.sdp = rtc.peer.localDescription;    // add discription to answer to remote once locally set
            });                                                 // note answer is shown to user in onicecandidate event above once resolved
        }                                                       // ice canidates start resolving after local discription is set
    },
    connect: function(peer){                            // what to do when a friends session id is entered
        ws.friend = peer ? peer : app.sessionInput.value; // set id to target friend value to use when ice canidates are gathered
        rtc.init(null, rtc.createOffer);
    }
};

var dataPeer = {
    channel: null,
    connected: false,
    newChannel: function(event){
        receiveChannel = event.channel;                                        // recieve channel events handlers created on connection
        receiveChannel.onerror = function onError(){};                         // handling errors could be a good idea
        receiveChannel.onmessage = function onMsg(event){
            var res = dataPeer.incoming(event.data);
            if(res.type){ws.send(res);}
        };
        receiveChannel.onopen = function onOpen(){dataPeer.connected = true;};    // handle events upon opening connection
        receiveChannel.onclose = function onClose(){dataPeer.connected = false;}; // doenst seem to work on closing a tab
    },
    incoming: function(message){               // handle incoming socket messages
        var req = {type: null};                // request
        try {req = JSON.parse(message);}       // probably should be wrapped in error handler
        catch(error){}                         // if error we don't care there is a default object
        var res = {type: null};                // response
        if(req.type === 'msg'){
            app.appendMsg('Peer: ' + req.msg); // onmessage event returns an object
        } else if(req.type === 'disconnect'){
            app.changeMode();
            rtc.peer.close();
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
        } else if(req.type === 'offer'){
            ws.friend = req.from;
            if(req.offer.sdp.type === 'offer'){
                rtc.init(null, function(){
                    rtc.offersAndAnswers(req.offer);
                });
            } else {
                rtc.offersAndAnswers(req.offer);
            }
        } else if(req.type === 'rando'){
            rtc.sessionId(req.peer);
        } else if(req.type === 'match'){
            app.changeMode();
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
    output: document.getElementById('voiceStream'),
    init: function(rtcInit){ // get user permistion to use media
        navigator.mediaDevices.getUserMedia({audio: true, video: false}).then(function onMedia(mediaStream){
            // var audioTracks = mediaStream.getAudioTracks();
            rtcInit(mediaStream);
        }).catch(function onNoMedia(error){
            rtcInit(null);
            console.log(error.message);
        });
        media.output.addEventListener('loadedmetadata', function(event){
            console.log('maybe a stream was added?: ' + JSON.stringify(event));
        });
    },
    ontrack: function(event){
        console.log(JSON.stringify(event));
        media.output.srcObject = event.streams[0];
        // document.getElementById('voiceStream').src = URL.createObjectURL(event.stream);
    }
};

var app = {
    inputStage: 0,
    inputLabelText: [
        'Paste friend id',
        'Sorry try a different id',
        'They might be chatting with someone'
    ],
    inputLabelEl: document.getElementById('inputLabel'),
    chatMode: false, // Determites if showing talkin mode or connecting mode
    receiveBox: document.getElementById('receiveBox'),
    sendBox: document.getElementById('sendBox'),
    sessionID: document.getElementById('sessionid'),
    sessionInput: document.getElementById('sessionInput'),
    setupBox: document.getElementById('setupBox'),
    msgArea: document.getElementById('msgArea'),
    init: function(){
        document.addEventListener('DOMContentLoaded', function(){       // wait till dom is loaded before manipulating it
            // media.init(rtc.init);                                       // start making rtc connection once we get media
            // rtc.init();
            app.msgArea.style.visibility = 'hidden';                    // not sure why this doesnt work in html
            ws.init(document.getElementById('socketserver').innerHTML); // grab socket server from compiled jekyll temlpate for this env
            document.getElementById('socketserver').style.visibility = 'hidden'; // hide, not sure how to do this in html
        });
        /*document.addEventListener('keyup', function(event){ // map enter button to sending message
            if(event.keyCode === 13){
                if(app.chatMode){
                    app.sendMsg();
                } else {
                    rtc.sessionId();
                }
            }
        });*/
    },
    randoConnect: function(){

    },
    sendMsg: function(){ // send messages to peer
        dataPeer.send({type: 'msg', msg: app.sendBox.value});
        app.appendMsg('Me  : ' + app.sendBox.value);
        app.sendBox.value = '';
    },
    endChat: function(){
        dataPeer.send({type: 'disconnect'});
        ws.send({type: 'disconnect'});
        rtc.peer.close();
        app.changeMode();
    },
    appendMsg: function(msg){  // add messages to message box
        var line = document.createElement('p');
        var txtNode = document.createTextNode(msg);
        line.appendChild(txtNode);
        app.receiveBox.appendChild(line);
    },
    changeMode: function(){ // change between chat or connect view
        app.chatMode = !app.chatMode;
        if(app.chatMode){
            app.msgArea.style.visibility = 'visible';
            app.setupBox.style.visibility = 'hidden';
        } else {
            app.receiveBox.innerHTML = '';
            app.msgArea.style.visibility = 'hidden';
            app.setupBox.style.visibility = 'visible';
        }
    }
};

app.init(); // start application
