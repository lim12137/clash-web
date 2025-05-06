# coding=utf-8

import asyncio
import datetime
import gzip
import json
import os
import time
import uuid
import wave
from enum import Enum
from io import BytesIO
from pathlib import Path
from typing import Dict, Any, Union

import aiofiles
import websockets
from dotenv import load_dotenv
from pydantic import BaseModel

from consts.const import TEST_VOICE_PATH

# Protocol constants
PROTOCOL_VERSION = 0b0001
DEFAULT_HEADER_SIZE = 0b0001

# Message Type:
CLIENT_FULL_REQUEST = 0b0001
CLIENT_AUDIO_ONLY_REQUEST = 0b0010
SERVER_FULL_RESPONSE = 0b1001
SERVER_ACK = 0b1011
SERVER_ERROR_RESPONSE = 0b1111

# Message Type Specific Flags
NO_SEQUENCE = 0b0000  # no check sequence
POS_SEQUENCE = 0b0001
NEG_SEQUENCE = 0b0010
NEG_WITH_SEQUENCE = 0b0011
NEG_SEQUENCE_1 = 0b0011

# Message Serialization
NO_SERIALIZATION = 0b0000
JSON = 0b0001
THRIFT = 0b0011
CUSTOM_TYPE = 0b1111

# Message Compression
NO_COMPRESSION = 0b0000
GZIP = 0b0001
CUSTOM_COMPRESSION = 0b1111


class AudioType(Enum):
    LOCAL = 1  # 使用本地音频文件
    STREAM = 2  # 使用流式音频


class STTConfig(BaseModel):
    appid: str
    token: str = ""
    ws_url: str = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel"
    uid: str = "streaming_asr_demo"
    format: str = "wav"
    rate: int = 16000
    bits: int = 16
    channel: int = 2
    codec: str = "raw"
    seg_duration: int = 10
    mp3_seg_size: int = 1000
    resourceid: str = "volc.bigasr.sauc.duration"
    streaming: bool = True
    compression: bool = True

    @classmethod
    def from_env(cls, env_file: Union[str, Path] = None):
        """Load configuration from environment variables or .env file"""
        if env_file:
            load_dotenv(env_file)

        return cls(
            appid=os.getenv("APPID", ""), token=os.getenv("TOKEN", ""),
            ws_url=os.getenv("WS_URL", "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel"),
            uid=os.getenv("UID", "streaming_asr_demo"), format=os.getenv("FORMAT", "pcm"),
            rate=int(os.getenv("RATE", "16000")), bits=int(os.getenv("BITS", "16")),
            channel=int(os.getenv("CHANNEL", "1")), codec=os.getenv("CODEC", "raw"),
            seg_duration=int(os.getenv("SEG_DURATION", "100")), mp3_seg_size=int(os.getenv("MP3_SEG_SIZE", "1000")),
            resourceid=os.getenv("RESOURCEID", "volc.bigasr.sauc.duration"),
            compression=os.getenv("COMPRESSION", "false").lower() == "true"
            )


class STTModel:
    def __init__(self, config: STTConfig):
        """
        Initialize the STT Model.
        
        Args:
            config: STT configuration
        """
        self.config = config
        self.success_code = 1000  # success code, default is 1000

    def generate_header(self, message_type=CLIENT_FULL_REQUEST, message_type_specific_flags=NO_SEQUENCE,
            serial_method=JSON, compression_type=None, reserved_data=0x00):
        """
        Generate protocol header.
        
        Args:
            message_type: Message type
            message_type_specific_flags: Message type specific flags
            serial_method: Serialization method
            compression_type: Compression type (optional, uses config if None)
            reserved_data: Reserved data
            
        Returns:
            Header bytes
        """
        # 使用配置中的压缩设置
        if compression_type is None:
            compression_type = GZIP if self.config.compression else NO_COMPRESSION

        header = bytearray()
        header_size = 1
        header.append((PROTOCOL_VERSION << 4) | header_size)
        header.append((message_type << 4) | message_type_specific_flags)
        header.append((serial_method << 4) | compression_type)
        header.append(reserved_data)
        return header

    @staticmethod
    def generate_before_payload(sequence: int):
        """
        Generate the payload prefix with sequence number.
        
        Args:
            sequence: Sequence number
            
        Returns:
            Payload prefix bytes
        """
        before_payload = bytearray()
        before_payload.extend(sequence.to_bytes(4, 'big', signed=True))  # sequence
        return before_payload

    @staticmethod
    def parse_response(res):
        """
        Parse response from server.
        
        Args:
            res: Response bytes
            
        Returns:
            Parsed response
        """
        protocol_version = res[0] >> 4
        header_size = res[0] & 0x0f
        message_type = res[1] >> 4
        message_type_specific_flags = res[1] & 0x0f
        serialization_method = res[2] >> 4
        message_compression = res[2] & 0x0f
        reserved = res[3]
        header_extensions = res[4:header_size * 4]
        payload = res[header_size * 4:]
        result = {'is_last_package': False, }
        payload_msg = None
        payload_size = 0

        if message_type_specific_flags & 0x01:
            # receive frame with sequence
            seq = int.from_bytes(payload[:4], "big", signed=True)
            result['payload_sequence'] = seq
            payload = payload[4:]

        if message_type_specific_flags & 0x02:
            # receive last package
            result['is_last_package'] = True

        if message_type == SERVER_FULL_RESPONSE:
            payload_size = int.from_bytes(payload[:4], "big", signed=True)
            payload_msg = payload[4:]
        elif message_type == SERVER_ACK:
            seq = int.from_bytes(payload[:4], "big", signed=True)
            result['seq'] = seq
            if len(payload) >= 8:
                payload_size = int.from_bytes(payload[4:8], "big", signed=False)
                payload_msg = payload[8:]
        elif message_type == SERVER_ERROR_RESPONSE:
            code = int.from_bytes(payload[:4], "big", signed=False)
            result['code'] = code
            payload_size = int.from_bytes(payload[4:8], "big", signed=False)
            payload_msg = payload[8:]

        if payload_msg is None:
            return result

        if message_compression == GZIP:
            payload_msg = gzip.decompress(payload_msg)

        if serialization_method == JSON:
            payload_msg = json.loads(str(payload_msg, "utf-8"))
        elif serialization_method != NO_SERIALIZATION:
            payload_msg = str(payload_msg, "utf-8")

        result['payload_msg'] = payload_msg
        result['payload_size'] = payload_size
        return result

    @staticmethod
    def read_wav_info(data: bytes = None) -> tuple[int, int, int, int, bytes]:
        """
        Read WAV file information.
        
        Args:
            data: WAV file data
            
        Returns:
            Tuple of (channels, sample width, frame rate, frames, wave bytes)
        """
        with BytesIO(data) as _f:
            wave_fp = wave.open(_f, 'rb')
            nchannels, sampwidth, framerate, nframes = wave_fp.getparams()[:4]
            wave_bytes = wave_fp.readframes(nframes)
        return nchannels, sampwidth, framerate, nframes, wave_bytes

    @staticmethod
    def slice_data(data: bytes, chunk_size: int):
        """
        Slice data into chunks.
        
        Args:
            data: Data to slice
            chunk_size: Chunk size
            
        Yields:
            Tuple of (chunk, last flag)
        """
        data_len = len(data)
        offset = 0
        while offset + chunk_size < data_len:
            yield data[offset: offset + chunk_size], False
            offset += chunk_size
        else:
            yield data[offset: data_len], True

    def construct_request(self, reqid):
        """
        Construct request parameters.
        
        Args:
            reqid: Request ID
            
        Returns:
            Request parameters dict
        """
        req = {"user": {"uid": self.config.uid, },
            "audio": {'format': self.config.format, "sample_rate": self.config.rate, "bits": self.config.bits,
                "channel": self.config.channel, "codec": self.config.codec, },
            "request": {"model_name": "bigmodel", "enable_punc": True, # "result_type": "single",
                # "vad_segment_duration": 800,
            }}
        print(f"req: {req}", end="\n\n")
        return req

    async def process_audio_data(self, audio_data: bytes, segment_size: int) -> Dict[str, Any]:
        """
        Process audio data and perform speech recognition.
        
        Args:
            audio_data: Audio data bytes
            segment_size: Segment size
            
        Returns:
            Recognition result
        """
        reqid = str(uuid.uuid4())
        seq = 1

        # Construct full client request, then serialize and compress
        request_params = self.construct_request(reqid)
        payload_bytes = str.encode(json.dumps(request_params))

        # 根据配置决定是否压缩
        if self.config.compression:
            payload_bytes = gzip.compress(payload_bytes)

        full_client_request = bytearray(self.generate_header(message_type_specific_flags=POS_SEQUENCE))
        full_client_request.extend(self.generate_before_payload(sequence=seq))
        full_client_request.extend((len(payload_bytes)).to_bytes(4, 'big'))  # payload size(4 bytes)
        full_client_request.extend(payload_bytes)  # payload

        # Prepare headers
        header = {"X-Api-Resource-Id": self.config.resourceid, "X-Api-Connect-Id": reqid}

        if self.config.token:
            header["X-Api-Access-Key"] = self.config.token

        if self.config.appid:
            header["X-Api-App-Key"] = self.config.appid

        print(f"Connecting to {self.config.ws_url} with headers: {header}")

        try:
            # Fix: Use additional_headers instead of extra_headers for websockets 15.0.1+
            async with websockets.connect(self.config.ws_url, additional_headers=header, max_size=1000000000) as ws:
                # Send full client request
                await ws.send(full_client_request)
                res = await ws.recv()
                result = self.parse_response(res)

                for _, (chunk, last) in enumerate(self.slice_data(audio_data, segment_size), 1):
                    seq += 1
                    if last:
                        seq = -seq

                    start = time.time()

                    # 根据配置决定是否压缩
                    if self.config.compression:
                        payload_bytes = gzip.compress(chunk)
                    else:
                        payload_bytes = chunk

                    if last:
                        audio_only_request = bytearray(self.generate_header(message_type=CLIENT_AUDIO_ONLY_REQUEST,
                            message_type_specific_flags=NEG_WITH_SEQUENCE))
                    else:
                        audio_only_request = bytearray(self.generate_header(message_type=CLIENT_AUDIO_ONLY_REQUEST,
                            message_type_specific_flags=POS_SEQUENCE))

                    audio_only_request.extend(self.generate_before_payload(sequence=seq))
                    audio_only_request.extend((len(payload_bytes)).to_bytes(4, 'big'))  # payload size(4 bytes)
                    audio_only_request.extend(payload_bytes)  # payload

                    # Send audio-only client request
                    await ws.send(audio_only_request)
                    res = await ws.recv()
                    result = self.parse_response(res)

                    if self.config.streaming:
                        sleep_time = max(0.0, self.config.seg_duration / 1000.0 - (time.time() - start))
                        await asyncio.sleep(sleep_time)

            return result

        except websockets.exceptions.ConnectionClosedError as e:
            print(f"WebSocket connection closed with status code: {e.code}")
            print(f"WebSocket connection closed with reason: {e.reason}")
            return {"error": f"Connection closed: {e.reason}"}

        except websockets.exceptions.WebSocketException as e:
            print(f"WebSocket connection failed: {e}")
            if hasattr(e, "status_code"):
                print(f"Response status code: {e.status_code}")
            if hasattr(e, "headers"):
                print(f"Response headers: {e.headers}")
            if hasattr(e, "response") and hasattr(e.response, "text"):
                print(f"Response body: {e.response.text}")
            return {"error": f"WebSocket error: {str(e)}"}

        except Exception as e:
            print(f"Unexpected error: {e}")
            import traceback
            traceback.print_exc()
            return {"error": f"Unexpected error: {str(e)}"}

    async def process_audio_file(self, audio_path: str) -> Dict[str, Any]:
        """
        Process audio file and perform speech recognition.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Recognition result
        """
        async with aiofiles.open(audio_path, mode="rb") as _f:
            data = await _f.read()
        audio_data = bytes(data)

        if self.config.format == "mp3":
            segment_size = self.config.mp3_seg_size
            return await self.process_audio_data(audio_data, segment_size)

        if self.config.format == "wav":
            nchannels, sampwidth, framerate, nframes, wav_bytes = self.read_wav_info(audio_data)
            size_per_sec = nchannels * sampwidth * framerate
            segment_size = int(size_per_sec * self.config.seg_duration / 1000)
            return await self.process_audio_data(audio_data, segment_size)

        if self.config.format == "pcm":
            segment_size = int(self.config.rate * 2 * self.config.channel * self.config.seg_duration / 500)
            return await self.process_audio_data(audio_data, segment_size)

        raise Exception("Unsupported format, only wav, mp3, and pcm are supported")

    async def process_streaming_audio(self, ws_client, segment_size: int):
        """
        Process streaming audio from WebSocket client and send transcription back.
        
        Args:
            ws_client: Client WebSocket connection
            segment_size: Audio segment size
            
        Returns:
            None
        """
        print("Starting audio processing loop...")
        reqid = str(uuid.uuid4())
        seq = 1
        client_connected = True  # 跟踪客户端连接状态

        # Construct full client request
        request_params = self.construct_request(reqid)
        payload_bytes = str.encode(json.dumps(request_params))

        # 根据配置决定是否压缩
        if self.config.compression:
            payload_bytes = gzip.compress(payload_bytes)

        # 生成请求头，传递None让函数根据配置决定compression_type
        full_client_request = bytearray(self.generate_header(message_type_specific_flags=POS_SEQUENCE))
        full_client_request.extend(self.generate_before_payload(sequence=seq))
        full_client_request.extend((len(payload_bytes)).to_bytes(4, 'big'))  # payload size(4 bytes)
        full_client_request.extend(payload_bytes)  # payload

        # Prepare headers
        header = {"X-Api-Resource-Id": self.config.resourceid, "X-Api-Request-Id": reqid}

        if self.config.token:
            header["X-Api-Access-Key"] = self.config.token

        if self.config.appid:
            header["X-Api-App-Key"] = self.config.appid

        print(f"Config: {self.config}")

        try:
            # Connect to STT service
            print(f"Connecting to STT WebSocket service at {self.config.ws_url}...")
            # Fix: Use additional_headers instead of extra_headers for websockets 15.0.1+
            async with websockets.connect(self.config.ws_url, additional_headers=header,
                                          max_size=1000000000) as ws_server:
                print("Connected to STT service")
                if hasattr(ws_server, 'response_headers'):
                    print(f"Response headers: {ws_server.response_headers}")

                # Send initial request
                print("Sending initial request...")
                await ws_server.send(full_client_request)
                print("Waiting for response...")
                response = await ws_server.recv()
                result = self.parse_response(response)
                print(f"Initial response received")

                # Tell client we're ready to receive audio
                print("Sending ready status to client...")
                try:
                    await ws_client.send_json({"status": "ready"})
                except Exception as e:
                    print(f"Client disconnected: {e}")
                    client_connected = False
                    return

                # Process streaming audio chunks
                counter = 0
                last_chunk_received = False

                while client_connected:
                    # Listen for audio data from client
                    try:
                        client_data = await ws_client.receive_bytes()
                    except Exception as e:
                        print(f"Error receiving audio data: {str(e)}")
                        client_connected = False
                        break

                    if not client_data:
                        print("Received empty audio data, indicating end of stream")
                        last_chunk_received = True
                        # Send a small empty buffer as the final chunk
                        client_data = bytes(0)

                    # Next sequence number
                    seq += 1

                    # Only use negative sequence for explicitly marked last chunk
                    if last_chunk_received:
                        seq = -abs(seq)  # Make sequence negative for last chunk
                        print("This is the final chunk, using negative sequence")

                        audio_only_request = bytearray(self.generate_header(message_type=CLIENT_AUDIO_ONLY_REQUEST,
                            message_type_specific_flags=NEG_WITH_SEQUENCE))
                    else:
                        audio_only_request = bytearray(self.generate_header(message_type=CLIENT_AUDIO_ONLY_REQUEST,
                            message_type_specific_flags=POS_SEQUENCE))

                    # 根据配置决定是否压缩
                    if self.config.compression:
                        payload_bytes = gzip.compress(client_data)
                    else:
                        payload_bytes = client_data

                    audio_only_request.extend(self.generate_before_payload(sequence=seq))
                    audio_only_request.extend((len(payload_bytes)).to_bytes(4, 'big'))  # payload size(4 bytes)
                    audio_only_request.extend(payload_bytes)  # payload

                    # Send to STT service
                    print(f"Sending audio chunk {counter + 1} to STT service ({len(audio_only_request)} bytes)...")
                    try:
                        await ws_server.send(audio_only_request)
                    except Exception as e:
                        print(f"Error sending to STT service: {e}")
                        if client_connected:
                            try:
                                await ws_client.send_json({"error": f"STT服务错误: {str(e)}"})
                                client_connected = False
                            except:
                                pass
                        break

                    # Get response and parse
                    try:
                        response = await ws_server.recv()
                        result = self.parse_response(response)
                        result_text = "empty"
                        try:
                            result_text = result['payload_msg']['result']['text'] if result['payload_msg']['result'][
                                'text'] else "empty"
                        except:
                            print(f"Malformed result: {result}")
                        print(f"Received response: {result_text}")

                        # Send result back to client
                        if client_connected and 'payload_msg' in result:
                            payload = result['payload_msg']

                            # Fix empty text results by adding a status indicator
                            if 'result' in payload and 'text' in payload['result'] and not payload['result']['text']:
                                payload['status'] = 'processing'

                            try:
                                await ws_client.send_json(payload)
                            except Exception as e:
                                print(f"Client disconnected while sending result: {e}")
                                client_connected = False
                                break
                        elif client_connected:
                            print("Sending processing status to client")
                            try:
                                await ws_client.send_json({"status": "processing"})
                            except Exception as e:
                                print(f"Client disconnected while sending status: {e}")
                                client_connected = False
                                break
                    except websockets.exceptions.ConnectionClosed as e:
                        print(f"STT service connection closed: {e}")
                        if last_chunk_received:
                            print("Expected closure after final chunk")
                            break
                        elif client_connected:
                            try:
                                await ws_client.send_json({"error": f"STT service connection closed unexpectedly: {e}"})
                                client_connected = False
                            except:
                                pass
                            break

                    counter += 1

                    # Exit after processing the last chunk
                    if last_chunk_received:
                        print("Last chunk processed, exiting loop")
                        break

                    # Simulate real-time processing if needed
                    if self.config.streaming:
                        sleep_time = max(0, (self.config.seg_duration / 1000.0))
                        await asyncio.sleep(sleep_time)

        except websockets.exceptions.ConnectionClosedError as e:
            error_msg = f"WebSocket connection closed: {e.reason} (code: {e.code})"
            print(f"Error: {error_msg}")
            if client_connected:
                try:
                    await ws_client.send_json({"error": error_msg})
                except:
                    print("无法发送错误信息：客户端已断开连接")

        except websockets.exceptions.WebSocketException as e:
            error_msg = f"WebSocket error: {str(e)}"
            print(f"Error: {error_msg}")
            if client_connected:
                try:
                    await ws_client.send_json({"error": error_msg})
                except:
                    print("无法发送错误信息：客户端已断开连接")

        except Exception as e:
            error_msg = f"Error in streaming session: {str(e)}"
            print(f"Error: {error_msg}")
            import traceback
            traceback.print_exc()
            if client_connected:
                try:
                    await ws_client.send_json({"error": error_msg})
                except:
                    print("无法发送错误信息：客户端已断开连接")

        finally:
            print("Audio processing loop ended")

    async def start_streaming_session(self, ws_client):
        """
        Start a streaming session for real-time STT.
        
        Args:
            ws_client: Client WebSocket connection
            
        Returns:
            None
        """
        print("Preparing streaming session...")
        # Calculate segment size based on audio parameters
        segment_size = int(self.config.rate * self.config.bits * self.config.channel / 8 * 0.1)  # 100ms chunk
        print(f"Using segment size: {segment_size} bytes (100ms of audio)")

        try:
            # Process streaming audio
            await self.process_streaming_audio(ws_client, segment_size)

        except Exception as e:
            error_msg = f"Error in streaming session: {str(e)}"
            print(f"Error: {error_msg}")
            import traceback
            traceback.print_exc()
            await ws_client.send_json({"error": error_msg})

    async def recognize_file(self, audio_path: str) -> Dict[str, Any]:
        """
        Recognize speech from audio file.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Recognition result
        """
        return await self.process_audio_file(audio_path)

    async def check_connectivity(self) -> bool:
        """
        测试与远程STT服务的连接是否正常
            
        Returns:
            bool: 连接成功返回True，失败返回False
        """
        try:
            result = await self.process_audio_file(TEST_VOICE_PATH)
            # 检查返回结果是否为字典类型且非空
            return isinstance(result, dict) and bool(result)
        except Exception:
            return False


async def process_audio_item(audio_item: Dict[str, Any], config: STTConfig) -> Dict[str, Any]:
    """
    Process an audio item with the STT model.
    
    Args:
        audio_item: Audio item with 'id' and 'path' keys
        config: STT configuration
        
    Returns:
        Recognition result with id and path
    """
    assert 'id' in audio_item
    assert 'path' in audio_item

    audio_id = audio_item['id']
    audio_path = audio_item['path']

    stt_model = STTModel(config)
    result = await stt_model.recognize_file(audio_path)

    return {"id": audio_id, "path": audio_path, "result": result}
