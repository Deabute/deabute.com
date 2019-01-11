// rtc.js ~ copyright 2019 Paul Beaudet ~ MIT License
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
        rtc.peer.setRemoteDescription(id.sdp);
        for(var i = 0; i < id.ice.length; i++){
            rtc.peer.addIceCandidate(id.ice[i]);
        }
        if(id.sdp.type === 'offer'){                            // create an answer when type is offer
            rtc.peer.createAnswer().then(function onAnswer(answer){
                return rtc.peer.setLocalDescription(answer);
            }).then(function onOfferSetDesc(){
                rtc.localID.sdp = rtc.peer.localDescription;
            });
        }
    },
    sendData: function(msg){if(rtc.channelOpen){rtc.dataChannel.send(msg);}},
    newDataChannel: function(event){
        receiveChannel = event.channel;
        receiveChannel.onerror = function onError(){};                         // handling errors could be a good idea
        receiveChannel.onmessage = function onMsg(event){
            app.appendMsg('Peer: ' + event.data);
        };
        receiveChannel.onopen = function onOpen(){rtc.channelOpen = true;};    // how one would handle events upon opening connection
        receiveChannel.onclose = function onClose(){rtc.channelOpen = false;}; // how one would handle events upon closing connection
    }
};

var app = {
    receiveBox: document.getElementById('receiveBox'),
    sendBox: document.getElementById('sendBox'),
    connectInput: document.getElementById('offerAnswerInput'),
    resultsField: document.getElementById('offerAnswerResults'),
    init: function(){
        document.addEventListener('DOMContentLoaded', function(){
            rtc.connectInit();
        });
    },
    sendMsg: function(){
        rtc.sendData(app.sendBox.value);
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

app.init();
