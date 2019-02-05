// rtctest.js ~ copyright 2019 Paul Beaudet ~ MIT License
// rtcSignal version - 1.0.21
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
                ws.send({type: 'ice', oid: localStorage.oid, canidate: event.candidate});
            }                                                   // null event.canidate means we finished recieving canidates
        };    // Also note that sdp is going to be negotiated first regardless of any media being involved. its faster to resolve
        rtc.peer.ondatachannel = dataPeer.newChannel;           // creates data endpoints for remote peer on rtc connection
        onSetupCB();                                            // create and offer or answer depending on what intiated
    },
    createOffer: function(){                                        // extend offer to client so they can send it to remote
        var offerConfig = { offerToReceiveAudio: 1, offerToReceiveVideo: 0 }; // can be passed to createOffer
        rtc.peer.createOffer(offerConfig).then( function onOffer(desc){       // get sdp data to show user, that will share with a friend
            return rtc.peer.setLocalDescription(desc);                        // note what sdp data self will use
        }).then( function onSet(){
            ws.send({type: 'offer', oid: localStorage.oid, sdp: rtc.peer.localDescription}); // send offer to connect
        });
    },
    giveAnswer: function(sdp){
        rtc.peer.setRemoteDescription(sdp);
        rtc.peer.createAnswer().then(function onAnswer(answer){ // create answer to remote peer that offered
            return rtc.peer.setLocalDescription(answer);        // set that offer as our local discripion
        }).then(function onOfferSetDesc(){
            ws.send({type: 'answer', oid: localStorage.oid, sdp: rtc.peer.localDescription, peerId: ws.peerId}); // send offer to friend
        });                                                     // note answer is shown to user in onicecandidate event above once resolved
    }
};

var dataPeer = {
    channel: null,
    connected: false,
    newChannel: function(event){
        receiveChannel = event.channel;                          // recieve channel events handlers created on connection
        receiveChannel.onerror = function onError(){};           // handling errors could be a good idea
        receiveChannel.onmessage = dataPeer.incoming;
        receiveChannel.onopen = function onOpen(){
            dataPeer.connected = true;
            dataPeer.send({type: 'connect', username: localStorage.username});
        };    // handle events upon opening connection
        receiveChannel.onclose = function onClose(){dataPeer.connected = false;}; // doenst seem to work on closing a tab
    },
    incoming: function(event){                              // handle incoming rtc messages
        var req = {type: null};                             // request defualt
        try {req = JSON.parse(event.data);}catch(error){}   // probably should be wrapped in error handler
        var res = {type: null};                             // response default
        if(req.type === 'disconnect'){                      // recieved when peer ends conversation
            app.closeConnection();                          // needs to happend after friend id is passed to nps
        } else if(req.type === 'connect'){
            app.discription.innerHTML = 'connected to ' + req.username;
            app.connectButton.innerHTML = 'Disconnect';
            app.connectButton.hidden = false;
        } // else { console.log(event.data); }        // will log message regardless of whether it was parsed
        if(res.type){dataPeer.send(res);}
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
    peerId: '',      // socket id of peer connection
    instance: null,    // placeholder for websocket object
    connected: false,  // set to true when connected to server
    server: document.getElementById('socketserver').innerHTML,
    init: function(){
        ws.instance = new WebSocket(ws.server);
        ws.instance.onopen = function(event){
            ws.connected = true;
            ws.instance.onmessage = ws.incoming;
            ws.send({type: 'connected', oid: localStorage.oid});
            ws.onclose = function onSocketClose(){ws.connected = false;};
            ws.onerror = function onSocketError(){console.log(error);};
        };
    },
    incoming: function(event){         // handle incoming socket messages
        var req = {type: null};          // request
        try {req = JSON.parse(event.data);} // probably should be wrapped in error handler
        catch(error){}                   // if error we don't care there is a default object
        var res = {type: null};          // response
        if(req.type === 'offer'){
            ws.peerId = req.id;
            rtc.init(function onInit(){rtc.giveAnswer(req.sdp);});
        } else if(req.type === 'answer'){
            ws.peerId = req.id;
            rtc.peer.setRemoteDescription(req.sdp);
        } else if(req.type === 'ice'){
            rtc.peer.addIceCandidate(req.canidate);
        } else if(req.type === 'pool'){
            pool.increment(req.count);
        } else if(req.type === 'nomatch'){
            app.showConnect(true);   // past true to keep in connection pool
            app.discription.innerHTML = 'no soup for you';
        } // else { console.log(event.data); }    // will log message regardless of whether it was parsed
        if(res.type){ws.send(res);}
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

var pool = {
    display: document.getElementById('pool'),
    count: 0, // assume peer is counted in pool
    increment: function(amount){
        pool.count = pool.count + amount;
        pool.display.innerHTML = pool.count;
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
                if(audioTracks[0].enabled){onMediaCallback();}
                else                      {onMediaCallback('Microphone muted');}
            } else {onMediaCallback('woah! no audio');}
        }).catch(function onNoMedia(error){onMediaCallback(error);});
    }
};

var prompt = {
    caller: false,
    feild: document.getElementById('promptFeild'),
    form: document.getElementById('promptForm'),
    answers: document.getElementById('formAnswers'),
    loaded: false, // only needs to load once, but we're probably going only call it when we need it
    load: function(onScriptCallback){
        if(prompt.loaded){
            onScriptCallback();
        } else {
            var script = document.createElement('script');
            script.onload = function(){
                prompt.loaded = true;
                onScriptCallback();
            };
            script.src = document.getElementById('host').innerHTML + '/assets/js/questions.js';
            document.head.appendChild(script);
        }
    },
    findCommon: function(){ // only find commonalities if we are connected to a peer this is called by
        var halflist = affinity.length / 2;
        if(prompt.caller){                    // search list from back
            halflist = Math.floor(halflist);  // take longer half of list
            for(var longHalf = affinity.length - 1; longHalf >= halflist; longHalf--){
                console.log(affinity[longHalf].question);
            }
        } else {                             // serch list from from front
            halflist = Math.floor(halflist); // take shorter half of list
            for(var shortHalf = 0; shortHalf < halflist; shortHalf++){
                console.log(affinity[shortHalf].question);
            }
        }
    },
    nps: function(peerId, onAnswer){
        prompt.load(function(){
            prompt.create(postChat[0], peerId, function whenAnswered(){
                prompt.remove();
                onAnswer();
            });
        });
    },
    create: function(questionObj, peerId, onAnswer){
        prompt.form.hidden = false;
        prompt.feild.innerHTML = questionObj.question;
        var answerBundle = document.createElement('div');
        answerBundle.id = 'answerBundle';
        prompt.answers.appendChild(answerBundle);
        var halfway = Math.floor(questionObj.answers.length/2);
        for(var i = 0; i < questionObj.answers.length; i++){
            var radioLabel = document.createElement('label');
            var radioOption = document.createElement('input');
            if(i === halfway){radioOption.checked = true;}
            radioLabel.for = 'answer' + i;
            radioOption.id = 'answer' + i;
            radioLabel.innerHTML = questionObj.answers[i];
            radioOption.type = 'radio';
            radioOption.name = 'answer';
            radioOption.value = i;
            answerBundle.appendChild(radioOption);
            answerBundle.appendChild(radioLabel);
            answerBundle.appendChild(document.createElement('br'));
        }
        function whenDone(answers){
            if(answers){localStorage.answers = JSON.stringify(answers);}
            onAnswer();
        }
        prompt.form.addEventListener('submit', function(event){
            event.preventDefault();
            var radios = document.getElementsByName('answer');
            var unifiedIndex = 4 - halfway; // this gives relitive values for questions with various numbers of answers which can be added with same relitive value
            for(var entry = 0; entry < radios.length; entry++){
                if(radios[entry].checked){
                    if(localStorage.answers){
                        var answers = JSON.parse(localStorage.answers);
                        for(var peer = 0; peer < answers.length; peer++){
                            if(answers[peer].oid === peerId){
                                answers[peer].nps = unifiedIndex;
                                whenDone(answers);
                                return;
                            }
                        }
                        answers.push({oid: peerId, nps: unifiedIndex});
                    } else { localStorage.answers = JSON.stringify([{oid: peerId, nps: unifiedIndex}]);}
                    whenDone();
                    return;
                }
                unifiedIndex++;
            }
        }, false);
    },
    remove: function(){
        prompt.answers.innerHTML = '';
        prompt.form.hidden = true;
        prompt.feild.innerHTML = '';
    }
};

var persistence = {
    init: function(onStorageLoad){
        if(localStorage){
            if(!localStorage.oid){localStorage.oid = persistence.createOid();}
            onStorageLoad(true, localStorage.oid, localStorage.username);
        } else { onStorageLoad(false); }

    },
    createOid: function(){
        var increment = Math.floor(Math.random() * (16777216)).toString(16);
        var pid = Math.floor(Math.random() * (65536)).toString(16);
        var machine = Math.floor(Math.random() * (16777216)).toString(16);
        var timestamp =  Math.floor(new Date().valueOf() / 1000).toString(16);
        return '00000000'.substr(0, 8 - timestamp.length) + timestamp + '000000'.substr(0, 6 - machine.length) + machine +
               '0000'.substr(0, 4 - pid.length) + pid + '000000'.substr(0, 6 - increment.length) + increment;
    },
};

var serviceTime = {
    START: [5, 16],
    END: [5, 22],
    WINDOW: document.getElementById('serviceWindow').innerHTML,
    next: function(){
        if(serviceTime.WINDOW === 't'){
            var startTime = new Date();
            var dayNow = startTime.getDay();
            var dateNow = startTime.getDate();
            var timeNow = startTime.getTime();
            var endTime = new Date();
            startTime.setDate(dateNow + (serviceTime.START[0] - dayNow));
            startTime.setHours(serviceTime.START[1], 0, 0, 0);
            endTime.setDate(dateNow + (serviceTime.END[0] - dayNow));
            endTime.setHours(serviceTime.END[1], 0, 0, 0);
            if(startTime.getTime() < timeNow){
                if (endTime.getTime() > timeNow){ return false; }
                else { return startTime; }
            }
            var startDate = startTime.getDate();
            startTime.setDate(startDate + 7);
            return startTime;
        } else { return false; }
    }
};

var app = {
    setupInput: document.getElementById('setupInput'),
    setupButton: document.getElementById('setupButton'),
    connectButton: document.getElementById('connectButton'),
    discription: document.getElementById('discription'),
    init: function(){
        document.addEventListener('DOMContentLoaded', function(){       // wait till dom is loaded before manipulating it
            persistence.init(function onLocalRead(capible, oid, username){
                if(capible){
                    var nextServiceTime = serviceTime.next();
                    if(nextServiceTime){
                        app.setupButton.hidden = true;
                        app.setupInput.hidden = true;
                        app.discription.innerHTML = 'Next session starts ' + nextServiceTime.toLocaleString();
                    } else { // connect to socket server if service is running at current time
                        if(username){
                            app.setupButton.innerHTML = 'Allow microphone';
                            app.discription.innerHTML = 'Welcome back ' + username;
                            app.setupInput.value = username;
                        } else {
                            app.setupButton.innerHTML = 'Enter name, allow microphone';
                        }
                        // ws.init(oid);
                    }
                } else {app.discription.innerHTML = 'Incompatible browser';}
            });
        });
    },
    setup: function(){
        app.setupButton.hidden = true;
        app.discription.innerHTML = 'Please allow Microphone, in order to connect';
        localStorage.username = app.setupInput.value;
        app.setupInput.hidden = true;
        media.init(function onMic(issue){
            if(issue){
                app.discription.innerHTML = 'Sorry there was an issue: ' + issue +
                '\n Unmute, remove restriction of microphone in address bar and try again, reload, or use chrome/firefox maybe?';
                app.setupButton.hidden = false;
            } else {
                app.showConnect(true);
                ws.init();
            }
        });
    },
    closeConnection: function(){
        prompt.nps(ws.peerId, app.showConnect);
        if(rtc.peer){ rtc.peer.close(); rtc.peer = null;} // clean up pre existing rtc connection if there
        ws.peerId = '';
        app.discription.innerHTML = '';
        app.connectButton.hidden = true;
    },
    showConnect: function(keepInConnectionPool){
        if(!keepInConnectionPool){ws.send({oid: localStorage.oid, type: 'disconnect'});} // tell server we are with previous connection
        app.discription.innerHTML = 'Press connect when ready to get a match';
        app.connectButton.innerHTML = 'Connect';
        app.connectButton.hidden = false;
        prompt.caller = false;
    },
    hideConnect: function(){
        app.connectButton.hidden = true;
    },
    toggleConnection: function(){
        if(dataPeer.connected){
            dataPeer.send({type: 'disconnect'});                  // tell friend we are done
            app.closeConnection();                                // do things that need to be done when done
        } else {
            rtc.init(function(){rtc.createOffer();});
            prompt.caller = true;
            app.discription.innerHTML = 'connecting';
            app.hideConnect();
        }
    }
};

app.init(); // start application
