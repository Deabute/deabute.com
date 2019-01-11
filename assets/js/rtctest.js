// rtctest.js ~ copyright 2019 Paul Beaudet ~ MIT License
// This test requires at least two browser windows, to open a data connection between two peers
var rtc = { // stun servers in config allow client to introspect a communication path to offer a remote peer
    config: {'iceServers': [ {'urls': 'stun:stun.stunprotocol.org:3478'}, {'urls': 'stun:stun.l.google.com:19302'} ]},
    peer: null,                      // placeholder for parent webRTC object instance
    dataChannel: null,               // object for local data channel end point
    localID: { sdp: null, ice: [] }, // package for user to send off to a friend they want to connect with
    channelOpen: false,              // false: closed data channel, true: open data channel
    connectInit: function(){
        rtc.peer = new RTCPeerConnection(rtc.config);           // create new instance for local client
        rtc.dataChannel = rtc.peer.createDataChannel('chat');   // Creates data endpoint for client's side of connection
        rtc.peer.onicecandidate = function onIce(event) {       // on address info being introspected (after local discription is set)
            if(event.candidate){                                // canididate property denotes data as multiple canidates can resolve
                rtc.localID.ice.push(event.candidate);          // Add a canidate to an array that we can package up and show user
            } else {                                            // null event.canidate means we finished recieving canidates
                app.resultsField.innerHTML = JSON.stringify(rtc.localID); // show user info to share with friend
            } // NOTE we show connection info to share once ice canidates are complete this can be slower to find a route
        };    // Also note that sdp is going to be negotiated first regardless of any media being involved. its faster to resolve
        rtc.peer.ondatachannel = rtc.newDataChannel;            // creates data endpoints for remote peer on rtc connection
    },
    getOffer: function(){                                       // extend offer to client so they can send it to remote
        rtc.peer.createOffer().then( function onOffer(desc){    // get sdp data to show user, that will share with a friend
            return rtc.peer.setLocalDescription(desc);          // note what sdp data self will use
        }).then( function onSet(){
            rtc.localID.sdp = rtc.peer.localDescription;        // set local discription into something that can be shared
        });
    },
    offersAndAnswers: function(){                               // method that gets called in recieving case with shared data provided
        var id = JSON.parse(app.connectInput.value);            // should be provided sdp and ice canidates from remote peer
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
    newDataChannel: function(event){
        receiveChannel = event.channel;                                        // recieve channel events handlers created on connection
        receiveChannel.onerror = function onError(){};                         // handling errors could be a good idea
        receiveChannel.onmessage = function onMsg(event){
            app.appendMsg('Peer: ' + event.data);                              // onmessage event returns an object
        };
        receiveChannel.onopen = function onOpen(){                             // handle events upon opening connection
            rtc.channelOpen = true;
            app.setupBox.innerHTML = '';
            app.connectionMsg.innerHTML = 'Connected';
        };
        receiveChannel.onclose = function onClose(){rtc.channelOpen = false;};// doenst seem to work on closing a tab
    }
};

var app = {
    receiveBox: document.getElementById('receiveBox'),
    sendBox: document.getElementById('sendBox'),
    connectInput: document.getElementById('offerAnswerInput'),
    resultsField: document.getElementById('offerAnswerResults'),
    connectionMsg: document.getElementById('connectionMsg'),
    setupBox: document.getElementById('setupBox'),
    init: function(){
        document.addEventListener('DOMContentLoaded', function(){
            rtc.connectInit();                              // start initializing webRTC objects once dom loads
        });
        document.addEventListener('keyup', function(event){ // map enter button to sending message
            if(event.keyCode === 13){app.sendMsg();}
        });
    },
    sendMsg: function(){
        if(rtc.channelOpen){
            rtc.dataChannel.send(app.sendBox.value);
        }
        app.appendMsg('Me  : ' + app.sendBox.value);
        app.sendBox.value = '';
    },
    appendMsg: function(msg){
        var line = document.createElement("p");
        var txtNode = document.createTextNode(msg);
        line.appendChild(txtNode);
        app.receiveBox.appendChild(line);
    }
};

app.init(); // start application
