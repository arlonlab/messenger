import "./App.css";
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://specialbond.arlonlabalan.com");

const App = () => {
    const [roomId, setRoomId] = useState("");
    const [joined, setJoined] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    
    useEffect(() => {
        socket.on("offer", async (data) => {
            if (peerConnection.current) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.current.createAnswer();
                await peerConnection.current.setLocalDescription(answer);
                socket.emit("answer", { room: data.room, answer });
            }
        });

        socket.on("answer", async (data) => {
            if (peerConnection.current) {
                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        });

        socket.on("ice-candidate", (data) => {
            if (peerConnection.current) {
                peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        });
    }, []);

    const joinRoom = () => {
        if (roomId.trim() !== "") {
            setJoined(true);
            socket.emit("join-room", roomId, socket.id);
            setupWebRTC();
        }
    };

    const setupWebRTC = async () => {
        peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", { room: roomId, candidate: event.candidate });
            }
        };

        peerConnection.current.ontrack = (event) => {
            remoteVideoRef.current.srcObject = event.streams[0];
        };

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach((track) => peerConnection.current.addTrack(track, stream));
        localVideoRef.current.srcObject = stream;
    };

    const toggleMute = () => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject.getAudioTracks()[0].enabled = isMuted;
            setIsMuted(!isMuted);
        }
    };

    const leaveRoom = () => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        setJoined(false);
        setRoomId("");
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
                    <video ref={localVideoRef} autoPlay playsInline muted />
                    <video ref={remoteVideoRef} autoPlay playsInline />
                    <div className="controls">
                        <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
                        <button onClick={leaveRoom} className="end-btn">End Call</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
