export const FUNDS = {
  ARGON: { name: 'The Argon Fund', color: '#49698C', motto: 'Noble, inert, and unmoved by the news.' },
  BOGLE: { name: 'The Bogle Fund', color: '#4E8A5A', motto: 'Buys the whole haystack.' },
  SMAUG: { name: 'The Smaug Fund', color: '#9C5248', motto: 'Sleeps on the pile and knows every coin in it.' },
  MIDAS: { name: 'The Midas Fund', color: '#B9902F', motto: 'Everything it touches, marked to gold.' },
  VLADD: { name: 'The Vladd Fund', color: '#6E5D8C', motto: 'Buys when there is blood in the streets.' },
};

export const fundOfChar = (charId) => FUNDS[String(charId).split('-')[0].toUpperCase()] || FUNDS.ARGON;
