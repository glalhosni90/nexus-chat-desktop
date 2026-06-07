import React, { useState, useRef, useEffect } from 'react';

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

function CallModal({ user, activeChat, socket, callState, onClose }) {
  const [callStatus, setCallStatus] = useState(callState.type === 'incoming' ? 'ringing' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);

  const isVideo = callState.callType === 'video';
  const peerId = callState.peerId;

  useEffect(() => {
    if (callState.type === 'outgoing') {
      initiateCall();
    }
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleAccepted = async ({ fromUserId }) => {
      if (fromUserId === peerId) {
        setCallStatus('connecting');
        await createOffer();
      }
    };

    const handleRejected = ({ fromUserId }) => {
      if (fromUserId === peerId) {
        setCallStatus('rejected');
        setTimeout(onClose, 2000);
      }
    };

    const handleEnded = ({ fromUserId }) => {
      if (fromUserId === peerId) {
        setCallStatus('ended');
        setTimeout(onClose, 1000);
      }
    };

    const handleOffer = async ({ fromUserId, offer }) => {
      if (fromUserId === peerId) {
        await handleRemoteOffer(offer);
      }
    };

    const handleAnswer = async ({ fromUserId, answer }) => {
      if (fromUserId === peerId) {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          startTimer();
          setCallStatus('connected');
        }
      }
    };

    const handleIceCandidate = ({ fromUserId, candidate }) => {
      if (fromUserId === peerId && pcRef.current) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
    };

    socket.on('call:accepted', handleAccepted);
    socket.on('call:rejected', handleRejected);
    socket.on('call:ended', handleEnded);
    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('call:accepted', handleAccepted);
      socket.off('call:rejected', handleRejected);
      socket.off('call:ended', handleEnded);
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
    };
  }, [socket, peerId]);

  const getMediaStream = async () => {
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };
    // Try with requested media first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: isVideo ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
      });
      return stream;
    } catch (err) {
      // If video failed, try audio only as fallback
      if (isVideo) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
          setErrorMsg('Camera unavailable, audio only');
          return stream;
        } catch (audioErr) {
          throw audioErr;
        }
      }
      throw err;
    }
  };

  const initiateCall = async () => {
    try {
      const stream = await getMediaStream();
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      socket.emit('call:initiate', { toUserId: peerId, callType: callState.callType });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Please allow microphone/camera access in browser settings');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No microphone or camera found');
      } else {
        setErrorMsg('Could not access media devices. Check browser permissions.');
      }
      setCallStatus('error');
      setTimeout(onClose, 4000);
    }
  };

  const acceptCall = async () => {
    setCallStatus('connecting');
    try {
      const stream = await getMediaStream();
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      socket.emit('call:accept', { toUserId: peerId });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Please allow microphone/camera access in browser settings');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No microphone or camera found');
      } else {
        setErrorMsg('Could not access media devices. Check browser permissions.');
      }
      setCallStatus('error');
      setTimeout(onClose, 4000);
    }
  };

  const rejectCall = () => {
    socket.emit('call:reject', { toUserId: peerId });
    onClose();
  };

  const endCall = () => {
    socket.emit('call:end', { toUserId: peerId });
    cleanup();
    onClose();
  };

  const createOffer = async () => {
    const pc = createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc:offer', { toUserId: peerId, offer });
  };

  const handleRemoteOffer = async (offer) => {
    const pc = createPeerConnection();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc:answer', { toUserId: peerId, answer });
    startTimer();
    setCallStatus('connected');
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', { toUserId: peerId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setCallStatus('ended');
        setTimeout(onClose, 1500);
      }
    };

    return pc;
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
  };

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const peerName = activeChat ? (activeChat.display_name || activeChat.displayName) : 'Unknown';

  return (
    <div className="call-overlay">
      <div className={`call-modal ${isVideo ? 'video-call' : 'audio-call'}`}>
        {isVideo && (
          <div className="call-video-container">
            <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
            <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
          </div>
        )}

        {!isVideo && (
          <div className="call-audio-container">
            <div className="call-avatar" style={{ background: activeChat?.avatar_color || '#6366f1' }}>
              {peerName.charAt(0).toUpperCase()}
            </div>
            <audio ref={remoteVideoRef} autoPlay />
          </div>
        )}

        <div className="call-info">
          <h3>{peerName}</h3>
          <span className="call-status-text">
            {callStatus === 'calling' && 'Calling...'}
            {callStatus === 'ringing' && 'Incoming call...'}
            {callStatus === 'connecting' && 'Connecting...'}
            {callStatus === 'connected' && formatDuration(callDuration)}
            {callStatus === 'rejected' && 'Call rejected'}
            {callStatus === 'ended' && 'Call ended'}
            {callStatus === 'error' && (errorMsg || 'Failed to access media')}
          </span>
          {errorMsg && callStatus === 'error' && (
            <p className="call-error-hint">Click the camera/microphone icon in the address bar to allow access</p>
          )}
        </div>

        <div className="call-actions">
          {callStatus === 'ringing' && (
            <>
              <button className="call-btn accept" onClick={acceptCall}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              </button>
              <button className="call-btn reject" onClick={rejectCall}>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
              </button>
            </>
          )}
          {(callStatus === 'calling' || callStatus === 'connecting' || callStatus === 'connected') && (
            <button className="call-btn end" onClick={endCall}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallModal;
