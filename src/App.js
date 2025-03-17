import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("https://specialbond.arlonlabalan.com");

const App = () => {
    const [roomId, setRoomId] = useState("");
    const [joined, setJoined] = useState(false);
    const [otherUserId, setOtherUserId] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);

    useEffect(() => {
        socket.on("other-user", (userId) => {
            setOtherUserId(userId);
            createPeerConnection(userId, true);
        });

        socket.on("user-connected", (userId) => {
            setOtherUserId(userId);
        });

        socket.on("offer", async ({ sdp, sender }) => {
            if (!peerConnection.current) {
                createPeerConnection(sender, false);
            }
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            socket.emit("answer", { sdp: answer, target: sender });
        });

        socket.on("answer", async ({ sdp }) => {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));
        });

        socket.on("ice-candidate", ({ candidate }) => {
            peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
        });

        socket.on("room-full", () => {
            alert("Room is full. Only two users can join a call.");
            setJoined(false);
            setRoomId("");
        });

        socket.on("user-disconnected", () => {
            endCall();
        });

        return () => {
            socket.off("other-user");
            socket.off("user-connected");
            socket.off("offer");
            socket.off("answer");
            socket.off("ice-candidate");
            socket.off("room-full");
            socket.off("user-disconnected");
        };
    }, []);

    const joinRoom = async () => {
        if (roomId.trim() !== "") {
            setJoined(true);
            socket.emit("join-room", roomId);
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideoRef.current.srcObject = stream;
        }
    };

    const createPeerConnection = (userId, isInitiator) => {
        peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", { candidate: event.candidate, target: userId });
            }
        };

        peerConnection.current.ontrack = (event) => {
            remoteVideoRef.current.srcObject = event.streams[0];
        };

        if (isInitiator) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
                stream.getTracks().forEach((track) => peerConnection.current.addTrack(track, stream));
                peerConnection.current.createOffer().then((offer) => {
                    peerConnection.current.setLocalDescription(offer);
                    socket.emit("offer", { sdp: offer, target: userId });
                });
            });
        }
    };

    const toggleMute = () => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject.getAudioTracks()[0].enabled = isMuted;
            setIsMuted(!isMuted);
        }
    };

    const endCall = () => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        setJoined(false);
        setRoomId("");
        setOtherUserId(null);
    };

    return (
        <div className="container">
            {!joined ? (
                <div className="join-container">
                    <input 
                        type="text" 
                        value={roomId} 
                        onChange={(e) => setRoomId(e.target.value)} 
                        placeholder="Enter Room ID" 
                        className="input-box"
                    />
                    <button className="join-btn" onClick={joinRoom}>Join</button>
                </div>
            ) : (
                <div className="video-container">
                    <video ref={localVideoRef} autoPlay playsInline muted className="video" />
                    {otherUserId && <video ref={remoteVideoRef} autoPlay playsInline className="video" />}
                    <div className="controls">
                        <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
                        <button onClick={endCall} className="end-btn">End Call</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
