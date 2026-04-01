import ExpoModulesCore
import DeviceCheck

/**
 * Apple DeviceCheck API を使用してデバイスの正当性を検証するモジュール
 *
 * DCDevice.current.generateToken() で生成されたトークンは、
 * サーバー側で Apple の DeviceCheck API に送信して検証する。
 * これによりリクエストが実際の Apple デバイス上の正規アプリから
 * 送信されたことを確認できる。
 */
public class DeviceAttestationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DeviceAttestation")

    Constants([
      "isSupported": DCDevice.current.isSupported
    ])

    AsyncFunction("generateDeviceToken") { (nonce: String) -> String in
      guard DCDevice.current.isSupported else {
        throw DeviceAttestationError.unsupported
      }

      return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
        DCDevice.current.generateToken { token, error in
          if let error = error {
            continuation.resume(throwing: error)
            return
          }
          guard let token = token else {
            continuation.resume(throwing: DeviceAttestationError.tokenGenerationFailed)
            return
          }
          continuation.resume(returning: token.base64EncodedString())
        }
      }
    }
  }
}

enum DeviceAttestationError: Error, LocalizedError {
  case unsupported
  case tokenGenerationFailed

  var errorDescription: String? {
    switch self {
    case .unsupported:
      return "DeviceCheck is not supported on this device"
    case .tokenGenerationFailed:
      return "Failed to generate device token"
    }
  }
}
