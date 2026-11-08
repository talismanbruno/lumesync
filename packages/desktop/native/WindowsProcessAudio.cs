// Lume process-loopback capture. No microphone, device-wide fallback, or recordings.
// stdout: little-endian length-prefixed stereo float32 PCM at 48 kHz.
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public static class WindowsProcessAudio
{
    [StructLayout(LayoutKind.Explicit, Size = 24)]
    private struct PropVariant
    {
        [FieldOffset(0)] public ushort Type;
        [FieldOffset(8)] public uint Size;
        [FieldOffset(16)] public IntPtr Data;
    }
    [StructLayout(LayoutKind.Sequential, Pack = 2)]
    private struct WaveFormat
    {
        public ushort Tag, Channels;
        public uint Rate, BytesPerSecond;
        public ushort Align, Bits, Extra;
    }
    [ComImport, Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioClient
    {
        [PreserveSig] int Initialize(int mode, uint flags, long duration, long period, ref WaveFormat format, IntPtr session);
        [PreserveSig] int GetBufferSize(out uint frames);
        [PreserveSig] int GetStreamLatency(out long latency);
        [PreserveSig] int GetCurrentPadding(out uint frames);
        [PreserveSig] int IsFormatSupported(int mode, IntPtr format, out IntPtr closest);
        [PreserveSig] int GetMixFormat(out IntPtr format);
        [PreserveSig] int GetDevicePeriod(out long standard, out long minimum);
        [PreserveSig] int Start();
        [PreserveSig] int Stop();
        [PreserveSig] int Reset();
        [PreserveSig] int SetEventHandle(IntPtr handle);
        [PreserveSig] int GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object service);
    }
    [ComImport, Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioCaptureClient
    {
        [PreserveSig] int GetBuffer(out IntPtr data, out uint frames, out uint flags, out ulong position, out ulong timestamp);
        [PreserveSig] int ReleaseBuffer(uint frames);
        [PreserveSig] int GetNextPacketSize(out uint frames);
    }
    [ComImport, Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IActivationOperation
    {
        [PreserveSig] int GetActivateResult(out int result, [MarshalAs(UnmanagedType.IUnknown)] out object activated);
    }
    [ComVisible(true), Guid("41D949AB-9862-444A-80F6-C261334DA5EB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface ICompletion
    {
        [PreserveSig] int ActivateCompleted([MarshalAs(UnmanagedType.Interface)] IActivationOperation operation);
    }
    [ComVisible(true), Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAgileObject { }
    [ComVisible(true), ClassInterface(ClassInterfaceType.None)]
    public sealed class Completion : ICompletion, IAgileObject
    {
        internal readonly ManualResetEvent Done = new ManualResetEvent(false);
        internal int Result;
        internal object Activated;
        public int ActivateCompleted(IActivationOperation operation)
        {
            try { int hr = operation.GetActivateResult(out Result, out Activated); if (hr < 0) Result = hr; }
            catch (Exception e) { Result = Marshal.GetHRForException(e); }
            finally { Done.Set(); }
            return 0;
        }
    }
    [DllImport("Mmdevapi.dll", ExactSpelling = true, CharSet = CharSet.Unicode)]
    private static extern int ActivateAudioInterfaceAsync(string path, ref Guid iid, ref PropVariant parameters,
        [MarshalAs(UnmanagedType.Interface)] ICompletion completion, out IActivationOperation operation);
    private static void Check(int hr) { if (hr < 0) Marshal.ThrowExceptionForHR(hr); }
    private static volatile bool stopping;
    private static string stage = "activation";

    [MTAThread]
    private static int Main(string[] args)
    {
        uint excluded;
        if (IntPtr.Size != 8 || args.Length != 1 || !uint.TryParse(args[0], out excluded) || excluded == 0) return 2;
        IAudioClient client = null;
        IAudioCaptureClient capture = null;
        IntPtr parameters = Marshal.AllocHGlobal(12);
        // AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK, TargetProcessId, EXCLUDE_TARGET_PROCESS_TREE.
        Marshal.WriteInt32(parameters, 0, 1);
        Marshal.WriteInt32(parameters, 4, unchecked((int)excluded));
        Marshal.WriteInt32(parameters, 8, 1);
        var completion = new Completion();
        IActivationOperation operation = null;
        try
        {
            using (var parent = Process.GetProcessById((int)excluded))
            using (var signal = new AutoResetEvent(false))
            using (var output = new BinaryWriter(Console.OpenStandardOutput()))
            {
                new Thread(() => { try { Console.OpenStandardInput().ReadByte(); } catch { } stopping = true; }) { IsBackground = true }.Start();
                var iid = typeof(IAudioClient).GUID;
                var variant = new PropVariant { Type = 65, Size = 12, Data = parameters };
                Check(ActivateAudioInterfaceAsync("VAD\\Process_Loopback", ref iid, ref variant, completion, out operation));
                if (!completion.Done.WaitOne(8000)) throw new TimeoutException("Audio activation timed out");
                stage = "activation-result";
                Check(completion.Result);
                client = (IAudioClient)completion.Activated;
                var format = new WaveFormat { Tag = 3, Channels = 2, Rate = 48000, BytesPerSecond = 384000, Align = 8, Bits = 32 };
                stage = "initialize";
                Check(client.Initialize(0, 0x60000, 200000, 0, ref format, IntPtr.Zero));
                iid = typeof(IAudioCaptureClient).GUID;
                object service;
                stage = "service";
                Check(client.GetService(ref iid, out service));
                capture = (IAudioCaptureClient)service;
                stage = "event";
                Check(client.SetEventHandle(signal.SafeWaitHandle.DangerousGetHandle()));
                stage = "start";
                Check(client.Start());
                Console.Error.WriteLine("READY 48000 2");
                while (!stopping && !parent.HasExited)
                {
                    signal.WaitOne(100);
                    uint next;
                    Check(capture.GetNextPacketSize(out next));
                    while (next > 0 && !stopping)
                    {
                        IntPtr data; uint frames, flags; ulong position, timestamp;
                        Check(capture.GetBuffer(out data, out frames, out flags, out position, out timestamp));
                        byte[] bytes;
                        try
                        {
                            if (frames > 48000) throw new InvalidDataException("Audio packet exceeds limit");
                            bytes = new byte[checked((int)frames * 8)];
                            if ((flags & 2) == 0) Marshal.Copy(data, bytes, 0, bytes.Length);
                        }
                        finally { Check(capture.ReleaseBuffer(frames)); }
                        output.Write(bytes.Length);
                        output.Write(bytes);
                        output.Flush();
                        Check(capture.GetNextPacketSize(out next));
                    }
                }
            }
            return 0;
        }
        catch (Exception e) { Console.Error.WriteLine("ERROR " + stage + " " + e.GetType().Name + " 0x" + Marshal.GetHRForException(e).ToString("X8")); return 1; }
        finally
        {
            if (client != null) { client.Stop(); Marshal.ReleaseComObject(client); }
            if (capture != null) Marshal.ReleaseComObject(capture);
            if (operation != null) Marshal.ReleaseComObject(operation);
            Marshal.FreeHGlobal(parameters);
            GC.KeepAlive(completion);
        }
    }
}
