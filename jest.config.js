export default {
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testRegex: '(\\.test)\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/tmp/', '/pkg/'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverage: true
}
