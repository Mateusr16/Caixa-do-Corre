import numpy as np,json
from PIL import Image, ImageDraw
from scipy.sparse import coo_matrix
d=np.load('baked.npz');P=d['P'];F=d['F']
# ossos: nome, pai, pivô, segmento (a,b), raio
J={
 'hips':(0.11,-0.24,0.30),'neck':(0.22,0.40,0.30),
 'shR':(0.40,0.30,0.30),'elR':(0.62,0.02,0.42),'haR':(0.66,0.34,0.60),
 'shL':(-0.24,0.33,0.30),'elL':(-0.42,0.02,0.40),'haL':(-0.19,-0.15,0.60),
 'hipL':(-0.03,-0.30,0.30),'knL':(-0.15,-0.60,0.30),'anL':(-0.24,-0.86,0.33),
 'hipR':(0.27,-0.30,0.30),'knR':(0.36,-0.60,0.30),'anR':(0.42,-0.86,0.33),
}
J={k:np.array(v) for k,v in J.items()}
B=[ # nome, pai, pivô, a, b, raio
 ('pelvis',-1,J['hips'],J['hips']+[0,-0.06,0],J['hips']+[0,0.1,0],0.22),
 ('chest',0,J['hips']+[0,0.08,0],J['hips']+[0,0.1,0],J['neck']+[0,-0.04,0],0.27),
 ('head',1,J['neck'],np.array([0.27,0.66,0.35]),np.array([0.27,0.70,0.35]),0.29),
 ('armR',1,J['shR'],J['shR'],J['elR'],0.12),
 ('foreR',3,J['elR'],J['elR'],J['haR'],0.11),
 ('armL',1,J['shL'],J['shL'],J['elL'],0.12),
 ('foreL',5,J['elL'],J['elL'],J['haL'],0.11),
 ('thighL',0,J['hipL'],J['hipL'],J['knL'],0.14),
 ('shinL',7,J['knL'],J['knL'],J['anL'],0.13),
 ('thighR',0,J['hipR'],J['hipR'],J['knR'],0.14),
 ('shinR',9,J['knR'],J['knR'],J['anR'],0.13),
]
def segd(p,a,b):
    ab=b-a;t=np.clip(((p-a)@ab)/(ab@ab+1e-12),0,1);return np.linalg.norm(p-(a+t[:,None]*ab),axis=1)
D=np.stack([segd(P,a,b)/r for _,_,_,a,b,r in B],1)
lab=np.argmin(D,1)
X,Y,Z=P.T
lab[(Y>0.44)&(np.linalg.norm(P-np.array([0.27,0.68,0.35]),axis=1)<0.36)]=2  # capacete
lab[(Z<0.06)&(Y>-0.28)&(Y<0.66)&(X<0.45)]=1          # bag e capuz atrás -> peito
lab[(Y<-0.86)&(X<0.12)]=8;lab[(Y<-0.86)&(X>=0.12)]=10   # pés
# mãos e dedos
fr=lab==4
lab[fr&(Y>0.20)]=11                                   # mão direita (levantada)
hr=lab==11
lab[hr&(Y>0.335)&(X>=0.525)&(X<0.60)]=12              # dedo esticado
lab[hr&(Y>0.32)&(X>=0.60)]=13                         # outros dedos
lab[hr&(Y>0.31)&(X<0.525)]=14                         # polegar
fl=lab==6
lab[fl&(X>-0.30)]=15                                  # mão esquerda (no quadril)
np.save('lab.npy',lab)
B+=[('handR',4,np.array([0.61,0.19,0.56]),None,None,0),('fingR',11,np.array([0.555,0.335,0.60]),None,None,0),
     ('fingR2',11,np.array([0.635,0.325,0.60]),None,None,0),('thumbR',11,np.array([0.53,0.31,0.60]),None,None,0),
     ('handL',6,np.array([-0.31,-0.10,0.52]),None,None,0)]
json.dump([dict(name=n,parent=p,pivot=[round(float(v),4) for v in pv]) for n,p,pv,_,_,_ in B],open('bones.json','w'))
cols=np.array([[200,200,200],[60,90,200],[240,240,60],[230,60,60],[255,150,150],[60,200,60],[150,255,150],[150,60,200],[210,150,255],[240,140,30],[255,200,120],[255,0,255],[0,255,255],[0,120,120],[255,255,255],[0,90,0]])
def render(R,name,S=500):
    V=P@R.T;Q=np.c_[(V[:,0]+1.1)/2.2*S,(1.1-V[:,1])/2.2*S]
    tri=V[F];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);n/=np.linalg.norm(n,axis=1,keepdims=True)+1e-12
    L=np.array([.3,.5,.8]);L/=np.linalg.norm(L);sh=0.45+0.55*np.clip(n@L,0,1)
    im=Image.new('RGB',(S,S),(235,235,235));dr=ImageDraw.Draw(im)
    fl=np.array([np.bincount(lab[f],minlength=16).argmax() for f in F])
    for t in np.argsort(tri[:,:,2].mean(1)):
        c=tuple(int(v) for v in cols[fl[t]]*sh[t]);dr.polygon([tuple(Q[k]) for k in F[t]],fill=c)
    im.save(name)
def roty(a):c,s=np.cos(a),np.sin(a);return np.array([[c,0,s],[0,1,0],[-s,0,c]])
for i,a in enumerate((0,np.pi/2,np.pi,-np.pi/2)):render(roty(a),f'r{i}.png')
g=Image.new('RGB',(2000,500));[g.paste(Image.open(f'r{i}.png'),(i*500,0)) for i in range(4)];g.save('rig.png')
print(np.bincount(lab,minlength=16))

# pesos suaves: difusão pela malha (respeita a superfície; mão encostada no quadril não gruda)
n=len(P);e=np.r_[F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]];e=np.r_[e,e[:,::-1]]
A=coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(n,n)).tocsr();A.data[:]=1
deg=np.asarray(A.sum(1)).ravel()+1
W=np.eye(len(B))[lab]
for _ in range(3):W=(A@W+W)/deg[:,None]
top=np.argsort(-W,1)[:,:2];w0=W[np.arange(n),top[:,0]];w1=W[np.arange(n),top[:,1]]
wf=w0/(w0+w1+1e-9)
np.savez('skin.npz',bi=top.astype('u1'),bw=wf)
print('blend verts',(wf<0.98).sum())
