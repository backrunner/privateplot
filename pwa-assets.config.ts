import {
  createAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    appleSplashScreens: createAppleSplashScreens({
      padding: 0.734,
      resizeOptions: { fit: 'contain', background: '#191a1b' },
      darkResizeOptions: { fit: 'contain', background: '#191a1b' },
      linkMediaOptions: {
        log: true,
        addMediaScreen: true,
        xhtml: true,
      },
    }, ['iPad Air 9.7"']),
  },
  images: 'public/avatar.png',
})