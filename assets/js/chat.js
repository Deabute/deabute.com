// rtctest.js ~ copyright 2019 Paul Beaudet ~ MIT License
// rtcSignal version - 1.0.21
// This test requires at least two browser windows, to open a data connection between two peers
var rtc = { // stun servers in config allow client to introspect a communication path to offer a remote peer
    config: {'iceServers': [ {'urls': 'stun:stun.stunprotocol.org:3478'}, {'urls': 'stun:stun.l.google.com:19302'} ]},
    peer: null,                                                 // placeholder for parent webRTC object instance
    connectionId: '',
    init: function(onSetupCB){                                  // varify mediastream before calling
        rtc.peer = new RTCPeerConnection(rtc.config);           // create new instance for local client
        media.stream.getTracks().forEach(function(track){rtc.peer.addTrack(track, media.stream);});
        rtc.peer.ontrack = media.ontrack;                       // behavior upon reciving track
        dataPeer.channel = rtc.peer.createDataChannel('chat');  // Creates data endpoint for client's side of connection
        rtc.peer.onicecandidate = function onIce(event) {       // on address info being introspected (after local discription is set)
            if(event.candidate){                                // canididate property denotes data as multiple candidates can resolve
                ws.send({type: 'ice', oid: localStorage.oid, candidate: event.candidate});
            }                                                   // null event.candidate means we finished recieving candidates
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
    giveAnswer: function(sdp, oidFromOffer){
        rtc.peer.setRemoteDescription(sdp);
        rtc.connectionId = oidFromOffer;
        rtc.peer.createAnswer().then(function onAnswer(answer){ // create answer to remote peer that offered
            return rtc.peer.setLocalDescription(answer);        // set that offer as our local discripion
        }).then(function onOfferSetDesc(){
            ws.send({type: 'answer', oid: localStorage.oid, sdp: rtc.peer.localDescription, peerId: oidFromOffer}); // send offer to friend
        });                                                     // note answer is shown to user in onicecandidate event above once resolved
    },
    close: function(){ // returns peer's oid
        ws.send({type: 'pause', oid: localStorage.oid});
        if(rtc.peer){  // clean up pre existing rtc connection if there
            rtc.peer.close();
            rtc.peer = null;
        }
        var peerId = rtc.connectionId;
        dataPeer.connected = false;
        dataPeer.ready = false;
        rtc.connectionId = '';
        return peerId;
    }
};

var dataPeer = {
    channel: null,
    connected: false,   // WE, two computer peers are connected
    ready: false,       // other human is ready
    clientReady: false, // I, human am ready
    talking: false,     // WE, humans are talking
    newChannel: function(event){
        receiveChannel = event.channel;                          // recieve channel events handlers created on connection
        receiveChannel.onerror = function onError(){};           // handling errors could be a good idea
        receiveChannel.onmessage = dataPeer.incoming;
        receiveChannel.onopen = function onOpen(){
            dataPeer.connected = true;
            dataPeer.send({type: 'connect', username: localStorage.username});
        };    // handle events upon opening connection
        // receiveChannel.onclose = function onClose(){rtc.close();};
    },
    incoming: function(event){                              // handle incoming rtc messages
        var req = {type: null};                             // request defualt
        try {req = JSON.parse(event.data);}catch(error){}   // probably should be wrapped in error handler
        if(req.type === 'disconnect'){                      // recieved when peer ends conversation
            dataPeer.clientReady = false;                   // no longer ready
            dataPeer.talking = false;                       // done talking
            app.disconnect();                               // needs to happend after friend id is passed to nps
        } else if(req.type === 'ready'){
            dataPeer.whenReady(function whenBothClientReady(){app.whenConnected(req.username);});
        } else if(req.type === 'connect'){
            console.log(req.username + ' connecting to us');
            if(dataPeer.clientReady){dataPeer.readySignal(function whenBothClientReady(){app.whenConnected(req.username);});}
            else                    {app.rtcReady(req.username);}
        }
    },
    disconnect: function(talking){
        dataPeer.send({type: 'disconnect'}); // tell friend we are done
        dataPeer.clientReady = false;        // no longer ready
        dataPeer.talking = false;            // done talking
        return rtc.close();                   // return id of who we were talking to
    },
    send: function(sendObj){
        try{sendObj = JSON.stringify(sendObj);} catch(error){console.log(error);}
        if(dataPeer.connected){
            dataPeer.channel.send(sendObj);
            return true;
        } else { return false;}
    },
    readySignal: function(onReady){
        console.log('sending ready signal');
        dataPeer.send({type:'ready', username: localStorage.username});
        dataPeer.clientReady = true;
        dataPeer.whenReady(onReady);
    },
    whenReady: function(onReady){
        if(dataPeer.ready){
            dataPeer.talking = true;
            dataPeer.ready = false;           // "we" are ready
            onReady();
        } else {dataPeer.ready = true;}
    },
    checkIfEatingPie: function(buttonElement){ // happens at confluence time
        console.log('checking for pie eaters');
        if(!dataPeer.talking){                 // given conversation is a dud
            var peerID = rtc.close();
            if(dataPeer.clientReady){
                console.log('not eatting pie');
                ws.send({type:'reduce', oid: peerID});
                ws.send({type: 'unmatched', oid: localStorage.oid}); // let server know we can be rematched
                app.waiting();                                       // show waiting for rematch
            } else {
                console.log('eating pie');
                if(!dataPeer.ready){ws.send({type: 'reduce', oid: peerID});} // in case both are eating pie
                buttonElement.onclick = dataPeer.missedTheBoat;
            } // this client is eating pie or doing something other than paying attention
        }
    },
    missedTheBoat: function(){
        if(pool.count){dataPeer.clientReady = true;}      // "I" am finally ready, if others are ready
        ws.send({type: 'repool', oid: localStorage.oid}); // let server know we can be rematched
        app.waiting();                                    // show waiting for rematch
    }
};

var ws = {
    instance: null,    // placeholder for websocket object
    connected: false,  // set to true when connected to server
    server: document.getElementById('socketserver').innerHTML,
    init: function(onConnection){
        ws.instance = new WebSocket(ws.server);
        ws.instance.onopen = function(event){
            ws.connected = true;
            ws.instance.onmessage = ws.incoming;
            ws.send({type: 'connected', oid: localStorage.oid});
            ws.onclose = function onSocketClose(){ws.connected = false;};
            ws.onerror = function onSocketError(){console.log(error);};
            onConnection();
        };
    },
    incoming: function(event){         // handle incoming socket messages
        var req = {type: null};          // request
        try {req = JSON.parse(event.data);} // probably should be wrapped in error handler
        catch(error){}                   // if error we don't care there is a default object
        var res = {type: null};          // response
        if(req.type === 'offer'){
            rtc.init(function onInit(){rtc.giveAnswer(req.sdp, req.id);});
        } else if(req.type === 'answer'){
            rtc.connectionId = req.id;
            rtc.peer.setRemoteDescription(req.sdp);
        } else if(req.type === 'ice'){
            rtc.peer.addIceCandidate(req.candidate);
        } else if(req.type === 'makeOffer'){
            if(req.pool){pool.set(req.pool);}
            app.connect();
        } else if(req.type === 'pool'){
            pool.increment(req.count);
        } else if(req.type === 'nomatch'){
            app.discription.innerHTML = 'no soup for you';
            setTimeout(app.waiting, 2000);
        }
        if(res.type){ws.send(res);}
    },
    send: function(msg){
        try{msg = JSON.stringify(msg);} catch(error){console.log(error);}
        if(ws.connected){
            ws.instance.send(msg);
            return true;
        } else { return false; }
    }
};

var pool = {
    display: document.getElementById('pool'),
    count: 0, // assume peer is counted in pool
    increment: function(amount){
        console.log('changing amount by ' + amount);
        pool.count = pool.count + amount;
        pool.display.innerHTML = pool.count;
    },
    set: function(setAmount){
        console.log('setting amount at ' + setAmount);
        pool.count = setAmount;
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
                if(audioTracks[0].enabled){onMediaCallback(null, mediaStream); audioTracks[0].enabled = false;}
                else                      {onMediaCallback('Microphone muted', null);}
            } else {onMediaCallback('woah! no audio', null);}
        }).catch(function onNoMedia(error){onMediaCallback(error, null);});
    },
    ontrack: function(event){media.output.srcObject = event.streams[0];},
    switchAudio: function(on){
        var audioTracks = media.stream.getAudioTracks();
        if(audioTracks.length){
            if(on){audioTracks[0].enabled = true;}
            else  {audioTracks[0].enabled = false;}
        }
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
    closingQuestion: function(peerId, onAnswer){
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
            prompt.caller = false;
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

var DEBUG_TIME = 6;
var serviceTime = {
    START: [5, 16],
    END: [5, 22],
    countDown: DEBUG_TIME,
    box: document.getElementById('timebox'),
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
    },
    check: function(confirmation, onConfluence){
        setTimeout(function nextSecond(){
            if(serviceTime.countDown){
                serviceTime.box.innerHTML = serviceTime.countDown;
                serviceTime.countDown--;
                if(serviceTime.countDown === 4){confirmation();}
                else if(serviceTime.countDown === 1){onConfluence();}
                serviceTime.check(confirmation, onConfluence);
            } else {
                serviceTime.box.innerHTML = 0;
                serviceTime.countDown = DEBUG_TIME;
            }
        }, 1000);
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
                    }
                } else {app.discription.innerHTML = 'Incompatible browser';}
            });
        });
    },
    issue: function(issue){
        app.discription.innerHTML = 'Sorry there was an issue: ' + issue +
        '\n Unmute, remove restriction of microphone in address bar and try again, reload, or use chrome/firefox maybe?';
        app.setupButton.hidden = false;
    },
    setup: function(){
        app.setupButton.hidden = true;
        app.discription.innerHTML = 'Please allow Microphone, in order to connect';
        localStorage.username = app.setupInput.value;
        app.setupInput.hidden = true;
        media.init(function onMic(issue, mediaStream){
            if(issue){ app.issue(issue);}
            else if (mediaStream){
                ws.init(function(){app.waiting(true);});
            } else {app.issue('No media stream present');}
        });
    },
    disconnect: function(){
        media.switchAudio(false);
        var peerId = dataPeer.disconnect();
        prompt.closingQuestion(peerId, function(){ // closes rtc connection, order important
            ws.send({type: 'repool', oid: localStorage.oid});
            app.waiting();
        });
        app.discription.innerHTML = '';
        app.connectButton.hidden = true;
    },
    rtcReady: function(username){
        serviceTime.check(function confirmation(){
            app.discription.innerHTML = 'Are you ready to chat?';
            app.connectButton.innerHTML = 'Ready to talk';
            app.connectButton.onclick = function oneClientReady(){
                app.discription.innerHTML = 'Waiting for peer';
                app.connectButton.hidden = true;
                dataPeer.readySignal(function whenBothClientReady(){app.whenConnected(username);});
            };
            app.connectButton.hidden = false;
        }, function figureDuds(){dataPeer.checkIfEatingPie(app.connectButton);});
    },
    whenConnected: function(username){
        media.switchAudio(true);
        ws.send({type:'reduce', oid: localStorage.oid});
        app.discription.innerHTML = 'connected to ' + username;
        app.connectButton.onclick = app.disconnect;
        app.connectButton.innerHTML = 'Disconnect';
        app.connectButton.hidden = false;
    },
    waiting: function(){
        app.discription.innerHTML = 'Waiting for connection pool to grow';
        app.connectButton.hidden = true;
    },
    connect: function(){
        rtc.init(function(){rtc.createOffer();});
        prompt.caller = true; // defines who instigator is, to split labor
        app.connectButton.hidden = true;
    }
};

app.init(); // start application
