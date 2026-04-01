package expo.modules.deviceattestation

import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.tasks.await

/**
 * Android 向けデバイス認証モジュール（Google Play Integrity API）
 *
 * Play Integrity API でインテグリティトークンを生成し、
 * サーバー側で Google の API に送信して検証する。
 * これにより、正規の Android デバイス上の Google Play からインストールされた
 * アプリからのリクエストであることを確認できる。
 */
class DeviceAttestationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeviceAttestation")

    Constants(
      "isSupported" to true
    )

    AsyncFunction("generateDeviceToken") { nonce: String ->
      val context = appContext.reactContext
        ?: throw Exception("React context is not available")

      val integrityManager = IntegrityManagerFactory.create(context)

      val request = IntegrityTokenRequest.builder()
        .setNonce(nonce)
        .build()

      val response = integrityManager.requestIntegrityToken(request).await()
      response.token()
    }
  }
}
